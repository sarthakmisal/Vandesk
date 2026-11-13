import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import compression from 'compression';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';

import { hashCode, need, newCode, signToken, verifyToken, type User } from './auth.ts';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import * as d from './domain.ts';
import { HttpError } from './http.ts';
import { tpl, type Mailer } from './mail.ts';
import { defaultDirection, ist, type Direction } from './time.ts';

const dir = z.enum(['pickup', 'drop']);
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));
const money = z.number().int().positive().max(10_000_000);
const hasStatus = (e: unknown): e is HttpError => e instanceof HttpError;

export function createApp(cfg: Config, db: Db, mail: Mailer) {
  const app = express();
  app.disable('x-powered-by');
  app.use(compression());
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));

  /* ------------------------------------------------------------- helpers */
  const handler =
    (fn: (req: Request, res: Response, u: User) => Promise<unknown>) => async (req: Request, res: Response) => {
      const u = res.locals['user'] as User;
      res.json((await fn(req, res, u)) ?? { ok: true });
    };
  const direction = (req: Request): Direction =>
    dir.safeParse(req.query['direction'] ?? req.body?.direction).data ?? defaultDirection(cfg.now());
  const sid = (req: Request) => String(req.params['id']);

  /* ---------------------------------------------------------------- auth */
  api.get('/health', (_req, res) => void res.json({ ok: true }));

  api.post('/auth/otp/request', async (req, res) => {
    const { email: to } = z.object({ email }).parse(req.body);
    const now = cfg.now();
    const u = (
      await db.query<User>(
        'select id, email, name, role, vehicle_id, active from app_user where lower(email) = $1 and active',
        [to],
      )
    ).rows[0];
    let devCode: string | undefined;
    if (u) {
      const n = (
        await db.query<{ n: number }>(
          'select count(*)::int as n from otp_challenge where email = $1 and created_at > $2',
          [to, new Date(now.getTime() - 3600_000).toISOString()],
        )
      ).rows[0].n;
      if (n >= 5) {
        throw new HttpError(429, 'Too many codes requested. Try again in an hour.'); // R-AUTH-1
      }
      const code = newCode();
      await db.query('insert into otp_challenge(email, code_hash, expires_at, created_at) values ($1,$2,$3,$4)', [
        to,
        hashCode(cfg.secret, to, code),
        new Date(now.getTime() + 5 * 60_000).toISOString(),
        now.toISOString(),
      ]);
      const m = tpl.otp(code);
      await mail.send(to, m.subject, m.text);
      devCode = cfg.devOtp ? code : undefined;
    }
    res.json({ ok: true, devCode }); // same answer whether or not the email exists: no account enumeration
  });

  api.post('/auth/otp/verify', async (req, res) => {
    const body = z.object({ email, code: z.string().trim().length(6) }).parse(req.body);
    const now = cfg.now();
    const c = (
      await db.query<{ id: number; code_hash: string; attempts: number }>(
        'select id, code_hash, attempts from otp_challenge where email = $1 and not consumed and expires_at > $2 order by id desc limit 1',
        [body.email, now.toISOString()],
      )
    ).rows[0];
    if (!c || c.attempts >= 5) {
      throw new HttpError(
        c ? 429 : 401,
        c ? 'Too many wrong codes. Request a new one.' : 'Code expired. Request a new one.',
      );
    }
    if (c.code_hash !== hashCode(cfg.secret, body.email, body.code)) {
      await db.query('update otp_challenge set attempts = attempts + 1 where id = $1', [c.id]);
      throw new HttpError(401, 'Wrong code');
    }
    await db.query('update otp_challenge set consumed = true where id = $1', [c.id]);
    const u = (
      await db.query<User>(
        'select id, email, name, role, vehicle_id, active from app_user where lower(email) = $1 and active',
        [body.email],
      )
    ).rows[0];
    if (!u) {
      throw new HttpError(403, 'Account suspended. Contact VanDesk.');
    }
    res.json({ token: signToken(cfg.secret, u, now), account: account(u) });
  });

  const account = (u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    veh: u.vehicle_id ?? undefined,
    gid: u.role === 'parent' ? u.id : undefined,
  });

  /* ------------------------------------------- cron jobs (secret, not a user) */
  api.get('/internal/jobs/:name', async (req, res) => {
    const given = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!cfg.cronSecret || given !== cfg.cronSecret) {
      throw new HttpError(401, 'Unauthorized');
    }
    const now = cfg.now();
    const name = req.params['name'];
    if (name === 'generate-dues') {
      return void res.json({ created: await d.generateDues(db, ist(now).period) });
    }
    if (name === 'send-reminders') {
      return void res.json(await d.sendReminders(db, mail, now, { manual: false }));
    }
    if (name === 'retention') {
      return void res.json(await d.retention(db, now));
    }
    throw new HttpError(404, 'Unknown job');
  });

  /* ------------------------------------- everything below needs a signed-in user */
  api.use(async (req: Request, res: Response, next: NextFunction) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const id = token ? verifyToken(cfg.secret, token, cfg.now()) : null;
    const u = id
      ? (await db.query<User>('select id, email, name, role, vehicle_id, active from app_user where id = $1', [id]))
          .rows[0]
      : undefined;
    if (!u || !u.active) {
      throw new HttpError(401, u ? 'Account suspended. Contact VanDesk.' : 'Please sign in');
    }
    res.locals['user'] = u;
    next();
  });

  api.get(
    '/me',
    handler(async (_r, _s, u) => account(u)),
  );

  /* ------------------------------------------------------------- students */
  api.get(
    '/vehicles',
    handler((_r, _s, u) => d.listVehicles(db, u)),
  );
  api.get(
    '/vehicles/:id/stops',
    handler((req, _s, u) => d.listStops(db, u, sid(req))),
  );
  api.get(
    '/students',
    handler((_r, _s, u) => d.listStudents(db, u)),
  );
  api.post(
    '/students',
    handler(async (req, _s, u) => {
      const f = z
        .object({
          name: z.string().trim().min(1, 'Student name is required').max(80),
          cls: z.string().trim().max(20).default(''),
          veh: z.string(),
          stop: z.string().default(''),
          gname: z.string().trim().min(1, 'Guardian name is required').max(80),
          email,
          phone: z.string().trim().max(20).default(''),
        })
        .parse(req.body);
      const r = await d.addStudent(db, u, f, ist(cfg.now()).period);
      await d.mailInvite(db, mail, r.id);
      return { id: r.id };
    }),
  );

  /* ----------------------------------------------------------------- fees */
  api.get(
    '/fees/pending',
    handler((_r, _s, u) => d.pending(db, u)),
  );
  api.get(
    '/fees/collected-today',
    handler(async (_r, _s, u) => ({ amount: await d.collectedToday(db, u, ist(cfg.now()).date) })),
  );
  api.get(
    '/students/:id/statement',
    handler((req, _s, u) => d.statement(db, u, sid(req))),
  );
  api.get(
    '/payments',
    handler((_r, _s, u) => d.ledger(db, u)),
  );
  api.post(
    '/payments',
    handler(async (req, _s, u) => {
      const f = z
        .object({
          studentId: z.string(),
          amount: money,
          mode: z.enum(['cash', 'upi', 'other']),
          clientUuid: z.string().max(64).optional(),
        })
        .parse(req.body);
      const r = await d.recordPayment(db, u, f, ist(cfg.now()).date);
      if (!r.duplicate) {
        await d.mailReceipt(db, mail, r.id, r.studentId, f.amount, r.balance, ist(cfg.now()).date);
      }
      return { id: r.id };
    }),
  );
  api.post(
    '/payments/:id/reverse',
    handler(async (req, _s, u) => {
      await d.reversePayment(db, u, sid(req), z.object({ note: z.string().default('') }).parse(req.body ?? {}).note);
    }),
  );
  api.get(
    '/fee-plans',
    handler((_r, _s, u) => d.plans(db, u)),
  );
  api.post(
    '/fee-plans',
    handler(async (req, _s, u) => {
      const f = z.object({ amount: money, from: z.iso.date() }).parse(req.body);
      return d.addPlan(db, u, f.amount, f.from);
    }),
  );
  api.post(
    '/reminders/send',
    handler(async (_r, _s, u) => {
      need(u, 'fees.record');
      return d.sendReminders(db, mail, cfg.now(), { vehicle: u.vehicle_id, manual: true });
    }),
  );

  /* ---------------------------------------------------------------- trips */
  api.get(
    '/trip',
    handler((req, _s, u) => d.tripView(db, u, direction(req), cfg.now())),
  );
  api.post(
    '/trip/start',
    handler((req, _s, u) => d.tripStart(db, u, direction(req), cfg.now())),
  );
  api.post(
    '/trip/end',
    handler((req, _s, u) => d.tripEnd(db, u, direction(req), cfg.now())),
  );
  api.post(
    '/trip/tap',
    handler(async (req, _s, u) => {
      const f = z
        .object({
          studentId: z.string(),
          direction: dir,
          kind: z.enum(['boarded', 'skipped']).default('boarded'),
          lat: z.number().min(-90).max(90).optional(),
          lng: z.number().min(-180).max(180).optional(),
          accuracy: z.number().min(0).optional(),
        })
        .parse(req.body);
      return d.tripTap(db, u, f, cfg.now());
    }),
  );

  api.get(
    '/children',
    handler((_r, _s, u) => d.children(db, u)),
  );
  api.get(
    '/children/:id/trip',
    handler((req, _s, u) => d.parentTrip(db, u, sid(req), direction(req), cfg.now())),
  );
  api.put(
    '/children/:id/attendance',
    handler(async (req, _s, u) => {
      const f = z.object({ going: z.boolean(), direction: dir }).parse(req.body);
      return d.setGoing(db, u, sid(req), f.going, f.direction, cfg.now());
    }),
  );

  /* ---------------------------------------------------------------- admin */
  api.get(
    '/admin/overview',
    handler((_r, _s, u) => d.adminOverview(db, u, cfg.now())),
  );
  api.put(
    '/admin/drivers/:id',
    handler(async (req, _s, u) => {
      await d.setDriverActive(db, u, sid(req), z.object({ active: z.boolean() }).parse(req.body).active);
    }),
  );

  api.use((_req, _res) => {
    throw new HttpError(404, 'Not found');
  });
  app.use('/api', api);

  /* --------------------------------------------- static app (the Ionic build in www/) */
  const root = resolve(cfg.staticDir);
  if (existsSync(resolve(root, 'index.html'))) {
    app.use(
      express.static(root, {
        index: false,
        setHeaders: (res, file) => {
          const hashed = /[-.][A-Za-z0-9_]{8,}\.(js|css|woff2?)$/.test(file);
          res.setHeader(
            'Cache-Control',
            file.endsWith('.html')
              ? 'no-cache'
              : hashed
                ? 'public, max-age=31536000, immutable'
                : 'public, max-age=3600',
          );
        },
      }),
    );
    // App routes (no file extension) get index.html; a missing file is a real 404, never index.html.
    app.use((req, res, next) => {
      if ((req.method === 'GET' || req.method === 'HEAD') && !/\.[a-z0-9]+$/i.test(req.path)) {
        res.setHeader('Cache-Control', 'no-cache');
        return void res.sendFile(resolve(root, 'index.html'));
      }
      next();
    });
  }

  app.use((e: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (hasStatus(e)) {
      return void res.status(e.status).json({ error: e.message });
    }
    if (e instanceof ZodError) {
      return void res.status(400).json({ error: e.issues[0]?.message ?? 'Invalid request' });
    }
    if ((e as { type?: string }).type === 'entity.parse.failed') {
      return void res.status(400).json({ error: 'Invalid JSON' });
    }
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  });
  return app;
}
