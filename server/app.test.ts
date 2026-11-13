import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb, type Db } from './db.ts';
import { createMailer, type Mailer } from './mail.ts';
import { seedDemo } from './seed.ts';

// 2026-11-02 09:00 IST (Monday)
let clock = new Date('2026-11-02T03:30:00Z');
let db: Db;
let mail: Mailer;
let base = '';
let close: () => void;

type Json = Record<string, any>;
const call = async (token: string | null, method: string, path: string, body?: unknown) => {
  const r = await fetch(base + '/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, body: json };
};
const signIn = async (email: string) => {
  const req = await call(null, 'POST', '/auth/otp/request', { email });
  const v = await call(null, 'POST', '/auth/otp/verify', { email, code: req.body['devCode'] });
  assert.equal(v.status, 200, `sign-in failed for ${email}`);
  return v.body['token'] as string;
};
const T: Record<string, string> = {};

before(async () => {
  const cfg = loadConfig({} as NodeJS.ProcessEnv, {
    memoryDb: true,
    staticDir: 'does-not-exist',
    cronSecret: 'cron-secret',
    now: () => clock,
    devOtp: true,
  });
  db = await createDb(cfg);
  await seedDemo(db, clock);
  mail = createMailer({ smtp: undefined, mailFrom: 'x', production: true });
  const server = createApp(cfg, db, mail).listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
  T['admin'] = await signIn('admin@vandesk.test');
  T['van'] = await signIn('ramesh@vandesk.test'); // driver of the Van (v1)
  T['bus'] = await signIn('suresh@vandesk.test'); // driver of the Bus (v2)
  T['patil'] = await signIn('mrpatil@mail.test'); // parent of s1, s2
  T['kulkarni'] = await signIn('mrskulkarni@mail.test'); // parent of s4
});
after(async () => {
  close();
  await db.close();
});

describe('sign-in (email OTP)', () => {
  it('does not reveal whether an email exists, and rejects wrong codes', async () => {
    const known = await call(null, 'POST', '/auth/otp/request', { email: 'ramesh@vandesk.test' });
    const unknown = await call(null, 'POST', '/auth/otp/request', { email: 'nobody@x.in' });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.equal(unknown.body['devCode'], undefined);
    assert.equal(
      (await call(null, 'POST', '/auth/otp/verify', { email: 'ramesh@vandesk.test', code: '000000' })).status,
      401,
    );
    assert.equal((await call(null, 'POST', '/auth/otp/verify', { email: 'nobody@x.in', code: '123456' })).status, 401);
  });
  it('sends the code by email and rate-limits requests (5 per hour)', async () => {
    const before = mail.outbox.length;
    for (let i = 0; i < 4; i++) {
      assert.equal((await call(null, 'POST', '/auth/otp/request', { email: 'admin@vandesk.test' })).status, 200);
    }
    assert.ok(mail.outbox.length > before);
    assert.equal((await call(null, 'POST', '/auth/otp/request', { email: 'admin@vandesk.test' })).status, 429);
  });
  it('requires a token and returns the account', async () => {
    assert.equal((await call(null, 'GET', '/me')).status, 401);
    assert.equal((await call('garbage', 'GET', '/me')).status, 401);
    const me = await call(T['van'], 'GET', '/me');
    assert.equal(me.body['role'], 'driver');
    assert.equal(me.body['veh'], 'v1');
  });
});

describe('RBAC: driver (own vehicle only)', () => {
  it('sees only own vehicle data', async () => {
    assert.equal((await call(T['van'], 'GET', '/students')).body.length, 5);
    assert.equal((await call(T['van'], 'GET', '/vehicles')).body.length, 1);
    const fees = (await call(T['van'], 'GET', '/fees/pending')).body as Json[];
    assert.ok(fees.length > 0 && fees.every((r) => r['veh'] === 'v1'));
  });
  it('cannot touch another vehicle or use other roles', async () => {
    assert.equal((await call(T['van'], 'GET', '/vehicles/v2/stops')).status, 403);
    assert.equal(
      (await call(T['van'], 'POST', '/payments', { studentId: 's6', amount: 100, mode: 'cash' })).status,
      403,
    );
    assert.equal((await call(T['van'], 'POST', '/trip/tap', { studentId: 's6', direction: 'pickup' })).status, 403);
    assert.equal(
      (await call(T['van'], 'POST', '/students', { name: 'X', veh: 'v2', gname: 'G', email: 'g@x.in' })).status,
      403,
    );
    assert.equal((await call(T['van'], 'GET', '/children')).status, 403);
    assert.equal((await call(T['van'], 'GET', '/admin/overview')).status, 403);
    assert.equal((await call(T['van'], 'PUT', '/admin/drivers/u2', { active: false })).status, 403);
  });
});

describe('RBAC: parent (own children only)', () => {
  it('sees only own children and cannot read or change another child', async () => {
    assert.deepEqual(
      ((await call(T['patil'], 'GET', '/children')).body as Json[]).map((c) => c['name']),
      ['Akshay Patil', 'Ishita Patil'],
    );
    assert.equal((await call(T['patil'], 'GET', '/children/s4/trip?direction=pickup')).status, 403);
    assert.equal(
      (await call(T['patil'], 'PUT', '/children/s4/attendance', { going: false, direction: 'pickup' })).status,
      403,
    );
    assert.equal((await call(T['patil'], 'GET', '/students/s4/statement')).status, 403);
    assert.equal((await call(T['patil'], 'GET', '/students/s2/statement')).body['balance'], 120000); // Ishita: 6 months (Jun-Nov) = 180000, 60000 paid
  });
  it('cannot do driver or admin things', async () => {
    assert.equal((await call(T['patil'], 'GET', '/students')).status, 403);
    assert.equal(
      (await call(T['patil'], 'POST', '/payments', { studentId: 's1', amount: 100, mode: 'cash' })).status,
      403,
    );
    assert.equal((await call(T['patil'], 'POST', '/trip/start', { direction: 'pickup' })).status, 403);
    assert.equal((await call(T['patil'], 'GET', '/admin/overview')).status, 403);
    assert.equal((await call(T['patil'], 'POST', '/reminders/send')).status, 403);
  });
});

describe('onboarding and fees', () => {
  it('adds a student with an invite email, enforces the seat limit, and the student appears in fees', async () => {
    const f = {
      name: 'Neel',
      cls: '4',
      veh: 'v1',
      stop: 't2',
      gname: 'Mr. Neel',
      email: 'neel.parent@x.in',
      phone: '99',
    };
    assert.equal((await call(T['van'], 'POST', '/students', f)).status, 200);
    assert.ok(mail.outbox.some((m) => m.to === 'neel.parent@x.in' && /invited/.test(m.subject)));
    assert.equal((await call(T['van'], 'POST', '/students', { ...f, name: 'Omkar', email: 'o@x.in' })).status, 409); // 6 of 6 seats
    assert.equal((await call(T['van'], 'POST', '/students', { ...f, email: 'bad' })).status, 400);
    const neel = ((await call(T['van'], 'GET', '/fees/pending')).body as Json[]).find((r) => r['name'] === 'Neel');
    assert.equal(neel?.['balance'], 30000);
    assert.equal(neel?.['months'], 1);
    const parent = await signIn('neel.parent@x.in'); // the invited guardian can sign in
    assert.equal(((await call(parent, 'GET', '/children')).body as Json[]).length, 1);
  });
  it('records instalments oldest first, emails one receipt, is idempotent, and reverses with a reason', async () => {
    const rohan = () => call(T['van'], 'GET', '/students/s5/statement').then((r) => r.body['balance'] as number);
    assert.equal(await rohan(), 180000);
    const r1 = await call(T['van'], 'POST', '/payments', {
      studentId: 's5',
      amount: 100000,
      mode: 'upi',
      clientUuid: 'abc-1',
    });
    assert.equal(await rohan(), 80000);
    const again = await call(T['van'], 'POST', '/payments', {
      studentId: 's5',
      amount: 100000,
      mode: 'upi',
      clientUuid: 'abc-1',
    });
    assert.equal(again.body['id'], r1.body['id']);
    assert.equal(await rohan(), 80000); // retry did not double-charge
    assert.equal(
      mail.outbox.filter((m) => m.to === 'mrsmore@mail.test' && /Payment received/.test(m.subject)).length,
      1,
    );
    const st = (await call(T['van'], 'GET', '/students/s5/statement')).body['rows'] as Json[];
    assert.deepEqual(
      st.map((x) => x['paid']),
      [30000, 30000, 30000, 10000, 0, 0],
    );
    assert.equal((await call(T['van'], 'POST', `/payments/${r1.body['id']}/reverse`, { note: '' })).status, 400);
    assert.equal(
      (await call(T['van'], 'POST', `/payments/${r1.body['id']}/reverse`, { note: 'typed wrong' })).status,
      200,
    );
    assert.equal(await rohan(), 180000);
    assert.equal((await call(T['van'], 'POST', `/payments/${r1.body['id']}/reverse`, { note: 'again' })).status, 409);
    const led = (await call(T['van'], 'GET', '/payments')).body as Json[];
    assert.ok(led.some((p) => p['id'] === r1.body['id'] && p['reversed'] === true));
    assert.equal((await call(T['bus'], 'POST', `/payments/${r1.body['id']}/reverse`, { note: 'x' })).status, 403); // other vehicle's driver
  });
  it('a new fee plan changes future dues only, and the dues job is idempotent', async () => {
    assert.equal((await call(T['van'], 'POST', '/fee-plans', { amount: 40000, from: '2026-06-01' })).status, 409);
    assert.equal((await call(T['van'], 'POST', '/fee-plans', { amount: 40000, from: '2026-12-01' })).status, 200);
    assert.equal((await call(null, 'GET', '/internal/jobs/generate-dues')).status, 401);
    clock = new Date('2026-12-01T19:00:00Z'); // 2026-12-02 00:30 IST
    const run1 = await fetch(base + '/api/internal/jobs/generate-dues', {
      headers: { authorization: 'Bearer cron-secret' },
    }).then((r) => r.json() as Promise<Json>);
    const run2 = await fetch(base + '/api/internal/jobs/generate-dues', {
      headers: { authorization: 'Bearer cron-secret' },
    }).then((r) => r.json() as Promise<Json>);
    assert.ok(run1['created'] > 0);
    assert.equal(run2['created'], 0);
    const rows = (await call(T['van'], 'GET', '/students/s5/statement')).body['rows'] as Json[];
    assert.equal(rows[0]['amt'], 30000); // old dues untouched
    assert.equal(rows[rows.length - 1]['amt'], 40000); // December uses the new plan
    clock = new Date('2026-11-02T03:30:00Z');
  });
});

describe('reminders', () => {
  it('driver button sends 1:1 emails and never twice on the same day; the cron job respects reminder days', async () => {
    const a = await call(T['van'], 'POST', '/reminders/send');
    assert.ok(a.body['sent'] > 0);
    const b = await call(T['van'], 'POST', '/reminders/send');
    assert.equal(b.body['sent'], 0);
    assert.equal(b.body['skipped'], a.body['sent']);
    const sent = mail.outbox.filter((m) => /Reminder: van fee/.test(m.subject));
    assert.equal(sent.length, a.body['sent']);
    assert.ok(sent.every((m) => !m.to.includes(',')));
    const job = await fetch(base + '/api/internal/jobs/send-reminders', {
      headers: { authorization: 'Bearer cron-secret' },
    }).then((r) => r.json() as Promise<Json>);
    assert.equal(job['sent'], 0); // 2 Nov is not a reminder day
    clock = new Date('2026-11-05T05:00:00Z'); // 5 Nov, 10:30 IST = reminder day inside the window
    const job2 = await fetch(base + '/api/internal/jobs/send-reminders', {
      headers: { authorization: 'Bearer cron-secret' },
    }).then((r) => r.json() as Promise<Json>);
    assert.ok(job2['sent'] > 0);
    clock = new Date('2026-11-02T03:30:00Z');
  });
});

describe('trips', () => {
  it('needs a started trip, runs in route order, captures GPS at the tap, undoes, and ends', async () => {
    assert.equal((await call(T['van'], 'POST', '/trip/tap', { studentId: 's1', direction: 'pickup' })).status, 409);
    assert.equal(
      (await call(T['patil'], 'PUT', '/children/s2/attendance', { going: false, direction: 'pickup' })).status,
      200,
    );
    await call(T['van'], 'POST', '/trip/start', { direction: 'pickup' });
    const view = (await call(T['van'], 'GET', '/trip?direction=pickup')).body;
    assert.equal(view['state']['status'], 'started');
    assert.equal(view['roster'][0]['stop'], 'Hanuman Mandir');
    assert.equal(view['roster'][0]['seq'], 1);
    assert.equal(view['roster'].find((r: Json) => r['id'] === 's2')['state'], 'off');
    await call(T['van'], 'POST', '/trip/tap', {
      studentId: 's1',
      direction: 'pickup',
      lat: 19.87612,
      lng: 75.34321,
      accuracy: 12,
    });
    let p = (await call(T['patil'], 'GET', '/children/s1/trip?direction=pickup')).body;
    assert.ok(p['picked']);
    assert.deepEqual(p['pin'], { lat: 19.876, lng: 75.343 }); // rounded (R-LOC-5)
    await call(T['van'], 'POST', '/trip/tap', { studentId: 's1', direction: 'pickup' }); // tap again = undo
    p = (await call(T['patil'], 'GET', '/children/s1/trip?direction=pickup')).body;
    assert.equal(p['picked'], undefined);
    await call(T['van'], 'POST', '/trip/tap', {
      studentId: 's3',
      direction: 'pickup',
      lat: 19.9,
      lng: 75.4,
      accuracy: 150,
    });
    const k = (await call(T['kulkarni'], 'GET', '/children/s4/trip?direction=pickup')).body;
    assert.equal(k['away'], 0); // Harsha is at stop 3, the van finished stop 2
    assert.equal(k['pin'], undefined); // poor accuracy is not shown (R-LOC-3)
    assert.equal(
      (await call(T['patil'], 'PUT', '/children/s1/attendance', { going: false, direction: 'pickup' })).status,
      409,
    ); // locked once started
    assert.equal((await call(T['van'], 'POST', '/trip/end', { direction: 'pickup' })).status, 200);
    assert.equal((await call(T['van'], 'GET', '/trip?direction=pickup')).body['state']['status'], 'ended');
  });
  it('flags a not-going change made after the 05:00 IST cutoff as late', async () => {
    clock = new Date('2026-11-03T00:30:00Z'); // 3 Nov, 06:00 IST (new day, no trip yet)
    await call(T['kulkarni'], 'PUT', '/children/s4/attendance', { going: false, direction: 'pickup' });
    const row = ((await call(T['van'], 'GET', '/trip?direction=pickup')).body['roster'] as Json[]).find(
      (r) => r['id'] === 's4',
    );
    assert.equal(row?.['state'], 'off');
    assert.equal(row?.['late'], true);
    clock = new Date('2026-11-02T03:30:00Z');
  });
  it('supports the afternoon drop run in reverse route order', async () => {
    clock = new Date('2026-11-02T09:00:00Z'); // 14:30 IST
    await call(T['van'], 'POST', '/trip/start', { direction: 'drop' });
    const roster = (await call(T['van'], 'GET', '/trip?direction=drop')).body['roster'] as Json[];
    assert.equal(roster[0]['stop'], 'Garden Chowk'); // last stop first
    await call(T['van'], 'POST', '/trip/tap', { studentId: 's4', direction: 'drop' });
    const k = (await call(T['kulkarni'], 'GET', '/children/s4/trip?direction=drop')).body;
    assert.ok(k['picked']);
    clock = new Date('2026-11-02T03:30:00Z');
  });
  it('removes raw coordinates after 90 days (retention job)', async () => {
    clock = new Date('2027-03-01T03:30:00Z');
    const r = await fetch(base + '/api/internal/jobs/retention', {
      headers: { authorization: 'Bearer cron-secret' },
    }).then((x) => x.json() as Promise<Json>);
    assert.ok(r['cleared'] > 0);
    assert.equal(
      (await db.query<{ n: number }>('select count(*)::int as n from trip_event where lat is not null')).rows[0].n,
      0,
    );
    clock = new Date('2026-11-02T03:30:00Z');
  });
});

describe('admin', () => {
  it('sees every vehicle, and suspending a driver blocks his token and sign-in', async () => {
    const o = (await call(T['admin'], 'GET', '/admin/overview')).body;
    assert.equal(o['vehicles'].length, 2);
    assert.ok(o['outstanding'] > 0);
    assert.equal((await call(T['admin'], 'POST', '/trip/start', { direction: 'pickup' })).status, 403);
    assert.equal((await call(T['admin'], 'PUT', '/admin/drivers/u2', { active: false })).status, 200);
    assert.equal((await call(T['bus'], 'GET', '/students')).status, 401);
    const req = await call(null, 'POST', '/auth/otp/request', { email: 'suresh@vandesk.test' });
    assert.equal(req.body['devCode'], undefined);
    assert.equal((await call(T['admin'], 'PUT', '/admin/drivers/u2', { active: true })).status, 200);
    assert.equal((await call(T['bus'], 'GET', '/students')).status, 200);
  });
});
