import { randomUUID } from 'node:crypto';

import { need, type User } from './auth.ts';
import type { Db, Q } from './db.ts';
import { HttpError } from './http.ts';
import { tpl, type Mailer } from './mail.ts';
import { ist, istTime, type Direction } from './time.ts';

const uid = (p: string) => p + randomUUID().slice(0, 8);
const forbidden = () => new HttpError(403, 'Not allowed');

/** Read scope as SQL: admin all, driver own vehicle, parent own children. */
export function scope(u: User, alias: string, idx: number): { sql: string; params: unknown[] } {
  if (u.role === 'admin') {
    return { sql: 'true', params: [] };
  }
  return u.role === 'driver'
    ? { sql: `${alias}.vehicle_id = $${idx}`, params: [u.vehicle_id] }
    : { sql: `${alias}.guardian_id = $${idx}`, params: [u.id] };
}

export async function visibleStudent(q: Q, u: User, sid: string) {
  const sc = scope(u, 's', 2);
  const r = await q.query<{
    id: string;
    name: string;
    vehicle_id: string;
    guardian_id: string;
    stop_id: string | null;
  }>(`select s.id, s.name, s.vehicle_id, s.guardian_id, s.stop_id from student s where s.id = $1 and ${sc.sql}`, [
    sid,
    ...sc.params,
  ]);
  if (!r.rows[0]) {
    throw forbidden();
  }
  return r.rows[0];
}

const audit = (q: Q, actor: string, action: string, entity: string, id: string, detail = '') =>
  q.query('insert into audit_log(actor, action, entity, entity_id, detail) values ($1,$2,$3,$4,$5)', [
    actor,
    action,
    entity,
    id,
    detail,
  ]);

/* ------------------------------------------------------------------ students */

export async function listVehicles(q: Q, u: User) {
  need(u, 'students.read');
  const r = await q.query(
    `select v.id, v.label, v.short, v.cap, (select count(*)::int from student s where s.vehicle_id = v.id and s.status <> 'left') as used
     from vehicle v where ($1 = 'admin' or v.id = $2) order by v.id`,
    [u.role, u.vehicle_id],
  );
  return r.rows;
}

export async function listStops(q: Q, u: User, vehicleId: string) {
  need(u, 'students.read');
  if (u.role !== 'admin' && u.vehicle_id !== vehicleId) {
    throw forbidden();
  }
  return (
    await q.query('select id, vehicle_id as veh, name, seq, typical from stop where vehicle_id = $1 order by seq', [
      vehicleId,
    ])
  ).rows;
}

export async function listStudents(q: Q, u: User) {
  need(u, 'students.read');
  const sc = scope(u, 's', 1);
  return (
    await q.query(
      `select s.id, s.name, s.cls, v.short as vehicle, coalesce(t.name, '') as stop, g.name as guardian
       from student s join vehicle v on v.id = s.vehicle_id left join stop t on t.id = s.stop_id join app_user g on g.id = s.guardian_id
       where ${sc.sql} order by s.name`,
      sc.params,
    )
  ).rows;
}

export interface NewStudent {
  name: string;
  cls: string;
  veh: string;
  stop: string;
  gname: string;
  email: string;
  phone: string;
}

/** Onboarding: seat limit is enforced inside the transaction with a row lock (R-SEAT-1). */
export async function addStudent(db: Db, u: User, f: NewStudent, period: string) {
  need(u, 'students.add');
  if (u.vehicle_id !== f.veh) {
    throw new HttpError(403, 'You can only add students to your own vehicle');
  }
  const name = f.name.trim();
  const gname = f.gname.trim();
  const email = f.email.trim().toLowerCase();
  return db.tx(async (q) => {
    const v = (
      await q.query<{ cap: number; short: string }>('select cap, short from vehicle where id = $1 for update', [f.veh])
    ).rows[0];
    if (!v) {
      throw new HttpError(400, 'Choose a vehicle');
    }
    const used = (
      await q.query<{ n: number }>(
        "select count(*)::int as n from student where vehicle_id = $1 and status <> 'left'",
        [f.veh],
      )
    ).rows[0].n;
    if (used >= v.cap) {
      throw new HttpError(409, `${v.short} is full (${v.cap} of ${v.cap} seats). Choose another vehicle.`);
    }
    let g = (
      await q.query<{ id: string; role: string }>('select id, role from app_user where lower(email) = $1', [email])
    ).rows[0];
    if (g && g.role !== 'parent') {
      throw new HttpError(409, 'This email belongs to another kind of account');
    }
    if (g) {
      const dup = await q.query('select 1 from student where guardian_id = $1 and lower(name) = lower($2)', [
        g.id,
        name,
      ]);
      if (dup.rows.length) {
        throw new HttpError(409, 'This student is already added');
      }
    } else {
      g = { id: uid('g'), role: 'parent' };
      await q.query("insert into app_user(id, email, name, role, phone) values ($1,$2,$3,'parent',$4)", [
        g.id,
        email,
        gname,
        f.phone.trim() || null,
      ]);
    }
    const sid = uid('s');
    await q.query(
      'insert into student(id, name, cls, vehicle_id, stop_id, guardian_id, joined) values ($1,$2,$3,$4,$5,$6,$7)',
      [sid, name, f.cls.trim(), f.veh, f.stop || null, g.id, period],
    );
    await generateDues(q, period);
    await audit(q, u.id, 'student.add', 'student', sid);
    return { id: sid, guardianId: g.id, guardianEmail: email, guardianName: g.role ? gname : gname };
  });
}

/* ---------------------------------------------------------------------- fees */

/** Idempotent: one due per student per month (unique), amount from the vehicle's plan in force. Full month for mid-month joins (R-FEE-4). */
export async function generateDues(q: Q, period: string): Promise<number> {
  const r = await q.query<{ student_id: string }>(
    `insert into fee_due (id, student_id, period, amount)
     select 'd' || s.id || $1::text, s.id, $1::text, p.amount from student s
     join lateral (select amount from fee_plan where vehicle_id = s.vehicle_id and effective_from <= ($1::text || '-01')::date order by effective_from desc limit 1) p on true
     where s.status = 'active' and s.joined <= $1::text
     on conflict (student_id, period) do nothing returning student_id`,
    [period],
  );
  for (const row of r.rows) {
    await applyCredit(q, row.student_id);
  }
  return r.rows.length;
}

const OUT = `(d.amount - coalesce((select sum(a.amount) from payment_allocation a where a.due_id = d.id), 0))::int`;

async function allocate(q: Q, paymentId: string, sid: string, amount: number) {
  const dues = await q.query<{ id: string; out: number }>(
    `select d.id, ${OUT} as out from fee_due d where d.student_id = $1 order by d.period`,
    [sid],
  );
  let left = amount;
  for (const d of dues.rows) {
    if (left <= 0) {
      break;
    }
    if (d.out > 0) {
      const take = Math.min(left, d.out); // oldest due first (R-PAY-2)
      await q.query('insert into payment_allocation(payment_id, due_id, amount) values ($1,$2,$3)', [
        paymentId,
        d.id,
        take,
      ]);
      left -= take;
    }
  }
}

/** Overpayment is advance credit, applied to new dues when they are generated. */
async function applyCredit(q: Q, sid: string) {
  const r = await q.query<{ credit: number }>(
    `select (coalesce((select sum(case when kind = 'payment' then amount else -amount end) from payment where student_id = $1), 0)
           - coalesce((select sum(a.amount) from payment_allocation a join payment p on p.id = a.payment_id where p.student_id = $1), 0))::int as credit`,
    [sid],
  );
  if (r.rows[0].credit > 0) {
    const p = await q.query<{ id: string }>(
      "select id from payment where student_id = $1 and kind = 'payment' order by created_at desc limit 1",
      [sid],
    );
    if (p.rows[0]) {
      await allocate(q, p.rows[0].id, sid, r.rows[0].credit);
    }
  }
}

export async function applyPayment(
  q: Q,
  sid: string,
  amount: number,
  mode: string,
  paidOn: string,
  by: string | null,
  uuid: string | null,
) {
  if (uuid) {
    const ex = await q.query<{ id: string }>('select id from payment where client_uuid = $1', [uuid]);
    if (ex.rows[0]) {
      return { id: ex.rows[0].id, duplicate: true };
    }
  }
  const id = uid('p');
  await q.query(
    "insert into payment(id, student_id, kind, amount, mode, paid_on, by_user, client_uuid) values ($1,$2,'payment',$3,$4,$5,$6,$7)",
    [id, sid, amount, mode, paidOn, by, uuid],
  );
  await allocate(q, id, sid, amount);
  return { id, duplicate: false };
}

export async function pending(q: Q, u: User) {
  need(u, 'fees.read');
  const sc = scope(u, 's', 1);
  const r = await q.query<{
    id: string;
    name: string;
    cls: string;
    veh: string;
    vehicle: string;
    period: string;
    out: number;
  }>(
    `select s.id, s.name, s.cls, s.vehicle_id as veh, v.short as vehicle, d.period, ${OUT} as out
     from student s join vehicle v on v.id = s.vehicle_id join fee_due d on d.student_id = s.id
     where s.status = 'active' and ${sc.sql} and ${OUT} > 0 order by d.period, s.name`,
    sc.params,
  );
  const by = new Map<
    string,
    {
      id: string;
      name: string;
      cls: string;
      vehicle: string;
      veh: string;
      months: number;
      balance: number;
      steps: number[];
      since: string;
    }
  >();
  for (const x of r.rows) {
    const e = by.get(x.id) ?? {
      id: x.id,
      name: x.name,
      cls: x.cls,
      vehicle: x.vehicle,
      veh: x.veh,
      months: 0,
      balance: 0,
      steps: [],
      since: x.period,
    };
    e.months += 1;
    e.balance += x.out;
    e.steps.push(e.balance);
    by.set(x.id, e);
  }
  return [...by.values()].sort((a, b) =>
    a.since < b.since ? -1 : a.since > b.since ? 1 : a.name.localeCompare(b.name),
  );
}

export async function collectedToday(q: Q, u: User, today: string) {
  need(u, 'fees.read');
  const sc = scope(u, 's', 2);
  const r = await q.query<{ n: number }>(
    `select coalesce(sum(case when p.kind = 'payment' then p.amount else -p.amount end), 0)::int as n
     from payment p join student s on s.id = p.student_id where p.paid_on = $1 and ${sc.sql}`,
    [today, ...sc.params],
  );
  return r.rows[0].n;
}

export async function statement(q: Q, u: User, sid: string) {
  need(u, 'fees.read');
  const s = await visibleStudent(q, u, sid);
  const rows = (
    await q.query<{ per: string; amt: number; paid: number }>(
      `select d.period as per, d.amount as amt, (d.amount - ${OUT})::int as paid from fee_due d where d.student_id = $1 order by d.period`,
      [sid],
    )
  ).rows;
  return { name: s.name, balance: rows.reduce((x, r) => x + r.amt - r.paid, 0), rows };
}

export async function ledger(q: Q, u: User) {
  need(u, 'fees.read');
  const sc = scope(u, 's', 1);
  return (
    await q.query(
      `select p.id, s.name as student, p.kind, p.amount, p.mode, p.paid_on::text as paid_on, coalesce(p.note, '') as note,
              exists (select 1 from payment r where r.rev_of = p.id) as reversed
       from payment p join student s on s.id = p.student_id where ${sc.sql} order by p.created_at desc, p.id desc limit 100`,
      sc.params,
    )
  ).rows;
}

export async function recordPayment(
  db: Db,
  u: User,
  f: { studentId: string; amount: number; mode: string; clientUuid?: string },
  today: string,
) {
  need(u, 'fees.record');
  return db.tx(async (q) => {
    await q.query('select id from student where id = $1 for update', [f.studentId]);
    const s = await visibleStudent(q, u, f.studentId);
    const r = await applyPayment(q, s.id, f.amount, f.mode, today, u.id, f.clientUuid ?? null);
    const bal = (await statement(q, u, s.id)).balance;
    return { ...r, studentId: s.id, studentName: s.name, balance: bal };
  });
}

/** Reversal row + negative allocations. The original row is never edited or deleted (R-PAY-1). */
export async function reversePayment(db: Db, u: User, pid: string, note: string) {
  need(u, 'fees.record');
  if (!note.trim()) {
    throw new HttpError(400, 'A reason is required');
  }
  await db.tx(async (q) => {
    const o = (
      await q.query<{ id: string; student_id: string; amount: number; mode: string }>(
        "select id, student_id, amount, mode from payment where id = $1 and kind = 'payment'",
        [pid],
      )
    ).rows[0];
    if (!o) {
      throw new HttpError(404, 'Payment not found');
    }
    await visibleStudent(q, u, o.student_id);
    if ((await q.query('select 1 from payment where rev_of = $1', [pid])).rows.length) {
      throw new HttpError(409, 'Already reversed');
    }
    const rid = uid('p');
    await q.query(
      "insert into payment(id, student_id, kind, amount, mode, paid_on, by_user, rev_of, note) values ($1,$2,'reversal',$3,$4,current_date,$5,$6,$7)",
      [rid, o.student_id, o.amount, o.mode, u.id, pid, note.trim()],
    );
    await q.query(
      'insert into payment_allocation(payment_id, due_id, amount) select $1, due_id, -amount from payment_allocation where payment_id = $2',
      [rid, pid],
    );
    await audit(q, u.id, 'payment.reverse', 'payment', pid, note.trim());
  });
}

export async function plans(q: Q, u: User) {
  need(u, 'fees.read');
  return (
    await q.query(
      `select id, vehicle_id as veh, amount, effective_from::text as effective_from from fee_plan where ($1 = 'admin' or vehicle_id = $2) order by effective_from desc`,
      [u.role, u.vehicle_id],
    )
  ).rows;
}

/** New plan applies from its start month; dues already generated never change (R-FEE-1). */
export async function addPlan(q: Q, u: User, amount: number, from: string) {
  need(u, 'fees.record');
  const last = (
    await q.query<{ f: string }>(
      'select effective_from::text as f from fee_plan where vehicle_id = $1 order by effective_from desc limit 1',
      [u.vehicle_id],
    )
  ).rows[0];
  if (last && from <= last.f) {
    throw new HttpError(409, 'Start date must be after the current plan starts');
  }
  const id = uid('f');
  await q.query('insert into fee_plan(id, vehicle_id, amount, effective_from) values ($1,$2,$3,$4)', [
    id,
    u.vehicle_id,
    amount,
    from,
  ]);
  await audit(q, u.id, 'plan.add', 'fee_plan', id, `${amount} from ${from}`);
  return { id };
}

/* ---------------------------------------------------------------- messaging */

async function sendLogged(
  db: Db,
  mail: Mailer,
  m: {
    to: string;
    userId: string | null;
    studentId: string | null;
    template: string;
    key: string;
    subject: string;
    text: string;
  },
) {
  const ins = await db.query<{ id: number }>(
    `insert into notification_log(user_id, student_id, template, dedupe_key, subject, body) values ($1,$2,$3,$4,$5,$6) on conflict (dedupe_key) do nothing returning id`,
    [m.userId, m.studentId, m.template, m.key, m.subject, m.text],
  );
  if (!ins.rows[0]) {
    return 'skipped' as const; // same key never sent twice (R-NOT-3)
  }
  try {
    await mail.send(m.to, m.subject, m.text);
    await db.query(
      "update notification_log set status = 'sent', attempts = attempts + 1, sent_at = now() where id = $1",
      [ins.rows[0].id],
    );
    return 'sent' as const;
  } catch (e) {
    await db.query("update notification_log set status = 'failed', attempts = attempts + 1, error = $2 where id = $1", [
      ins.rows[0].id,
      String(e),
    ]);
    return 'failed' as const;
  }
}

export async function mailReceipt(
  db: Db,
  mail: Mailer,
  paymentId: string,
  studentId: string,
  amount: number,
  balance: number,
  date: string,
) {
  const g = (
    await db.query<{ gname: string; email: string; id: string; sname: string }>(
      'select g.name as gname, g.email, g.id, s.name as sname from student s join app_user g on g.id = s.guardian_id where s.id = $1',
      [studentId],
    )
  ).rows[0];
  if (g) {
    const t = tpl.receipt(g.gname, g.sname, amount, date, balance);
    await sendLogged(db, mail, {
      to: g.email,
      userId: g.id,
      studentId,
      template: 'receipt',
      key: `receipt:${paymentId}`,
      ...t,
    });
  }
}

export async function mailInvite(db: Db, mail: Mailer, studentId: string) {
  const g = (
    await db.query<{ gname: string; email: string; id: string; sname: string }>(
      'select g.name as gname, g.email, g.id, s.name as sname from student s join app_user g on g.id = s.guardian_id where s.id = $1',
      [studentId],
    )
  ).rows[0];
  if (g) {
    await sendLogged(db, mail, {
      to: g.email,
      userId: g.id,
      studentId,
      template: 'invite',
      key: `invite:${studentId}`,
      ...tpl.invite(g.gname, g.sname),
    });
  }
}

const reminderDay = (day: number) => [1, 5, 10, 15].includes(day) || (day > 15 && (day - 15) % 7 === 0);

/**
 * Fee reminders, 1:1 to the guardian, deduped per student per day.
 * Scheduled run: only on reminder days and inside the 09:00-20:00 IST window (R-NOT-1). Manual run (driver button): any time.
 */
export async function sendReminders(
  db: Db,
  mail: Mailer,
  now: Date,
  opts: { vehicle?: string | null; manual: boolean },
) {
  const t = ist(now);
  if (!opts.manual && !(reminderDay(t.day) && t.hour >= 9 && t.hour < 20)) {
    return { sent: 0, skipped: 0, failed: 0, note: 'Not a reminder day or outside the send window' };
  }
  const r = await db.query<{ id: string; name: string; gid: string; gname: string; email: string; bal: number }>(
    `select s.id, s.name, g.id as gid, g.name as gname, g.email,
            coalesce(sum(${OUT}), 0)::int as bal
     from student s join app_user g on g.id = s.guardian_id join fee_due d on d.student_id = s.id
     where s.status = 'active' and ($1::text is null or s.vehicle_id = $1::text)
     group by s.id, g.id having coalesce(sum(${OUT}), 0) > 0 order by s.name`,
    [opts.vehicle ?? null],
  );
  const out = { sent: 0, skipped: 0, failed: 0, note: '' };
  for (const x of r.rows) {
    const res = await sendLogged(db, mail, {
      to: x.email,
      userId: x.gid,
      studentId: x.id,
      template: 'reminder',
      key: `rem:${x.id}:${t.date}`,
      ...tpl.reminder(x.gname, x.name, x.bal),
    });
    out[res] += 1;
  }
  return out;
}

/** Data retention (R-LOC-7): raw coordinates are removed after 90 days; the events stay. */
export async function retention(q: Q, now: Date) {
  const cutoff = new Date(now.getTime() - 90 * 86400000).toISOString();
  const r = await q.query(
    'update trip_event set lat = null, lng = null, accuracy = null where at < $1 and lat is not null returning id',
    [cutoff],
  );
  return { cleared: r.rows.length };
}

/* --------------------------------------------------------------------- trips */

const cutoff = (dir: Direction) => (dir === 'pickup' ? '05:00' : '12:00'); // R-ATT-2: parents may change until 05:00 for pickup (driver checks in the morning, not at midnight)

async function getTrip(q: Q, vehicleId: string, date: string, dir: Direction) {
  return (
    await q.query<{ id: string; status: string; started_at: Date | null; ended_at: Date | null }>(
      'select id, status, started_at, ended_at from trip where vehicle_id = $1 and trip_date = $2 and direction = $3',
      [vehicleId, date, dir],
    )
  ).rows[0];
}

const myVehicle = (u: User) => {
  need(u, 'trip.run');
  if (!u.vehicle_id) {
    throw forbidden();
  }
  return u.vehicle_id;
};

export async function tripView(q: Q, u: User, dir: Direction, now: Date) {
  const vid = myVehicle(u);
  const date = ist(now).date;
  const t = await getTrip(q, vid, date, dir);
  const sign = dir === 'pickup' ? 1 : -1; // the drop run visits the route in reverse
  const rows = (
    await q.query<{
      id: string;
      name: string;
      stop: string;
      seq: number | null;
      kind: string | null;
      at: Date | null;
      going: boolean | null;
      is_late: boolean | null;
    }>(
      `select s.id, s.name, coalesce(st.name, '') as stop, st.seq, e.kind, e.at, ai.going, ai.is_late
       from student s left join stop st on st.id = s.stop_id
       left join trip_event e on e.trip_id = $4 and e.student_id = s.id
       left join attendance_intent ai on ai.student_id = s.id and ai.trip_date = $2 and ai.direction = $3
       where s.vehicle_id = $1 and s.status = 'active'`,
      [vid, date, dir, t?.id ?? null],
    )
  ).rows;
  rows.sort((a, b) => sign * ((a.seq ?? 99) - (b.seq ?? 99)) || a.name.localeCompare(b.name));
  return {
    direction: dir,
    state: { status: t ? t.status : 'idle', startedAt: istTime(t?.started_at), endedAt: istTime(t?.ended_at) },
    roster: rows.map((r) => ({
      id: r.id,
      name: r.name,
      stop: r.stop,
      state: r.going === false ? 'off' : (r.kind ?? 'wait'),
      at: istTime(r.at),
      late: !!r.is_late,
    })),
  };
}

export async function tripStart(q: Q, u: User, dir: Direction, now: Date) {
  const vid = myVehicle(u);
  const date = ist(now).date;
  const t = await getTrip(q, vid, date, dir);
  if (t?.status === 'started') {
    return; // resume (R-TRIP-1)
  }
  if (t) {
    await q.query('delete from trip_event where trip_id = $1', [t.id]);
    await q.query("update trip set status = 'started', started_at = $2, ended_at = null where id = $1", [
      t.id,
      now.toISOString(),
    ]);
  } else {
    await q.query(
      "insert into trip(id, vehicle_id, trip_date, direction, status, started_at) values ($1,$2,$3,$4,'started',$5)",
      [uid('t'), vid, date, dir, now.toISOString()],
    );
  }
}

/** Never blocked, even with unmarked students (R-TRIP-5). */
export async function tripEnd(q: Q, u: User, dir: Direction, now: Date) {
  const vid = myVehicle(u);
  await q.query(
    "update trip set status = 'ended', ended_at = $4 where vehicle_id = $1 and trip_date = $2 and direction = $3",
    [vid, ist(now).date, dir, now.toISOString()],
  );
}

export interface Tap {
  studentId: string;
  direction: Direction;
  kind: 'boarded' | 'skipped';
  lat?: number;
  lng?: number;
  accuracy?: number;
}

/** One tap per student, tap again = undo. Location is captured only here, at the tap (R-LOC-1); a missing fix never blocks it (R-LOC-2). */
export async function tripTap(db: Db, u: User, f: Tap, now: Date) {
  const vid = myVehicle(u);
  return db.tx(async (q) => {
    const s = (await q.query<{ vehicle_id: string }>('select vehicle_id from student where id = $1', [f.studentId]))
      .rows[0];
    if (!s || s.vehicle_id !== vid) {
      throw forbidden();
    }
    const date = ist(now).date;
    const t = await getTrip(q, vid, date, f.direction);
    if (t?.status !== 'started') {
      throw new HttpError(409, 'Start the trip first');
    }
    const intent = (
      await q.query<{ going: boolean }>(
        'select going from attendance_intent where student_id = $1 and trip_date = $2 and direction = $3',
        [f.studentId, date, f.direction],
      )
    ).rows[0];
    if (intent && !intent.going) {
      return { state: 'off' };
    }
    const ex = (
      await q.query<{ id: string; kind: string }>(
        'select id, kind from trip_event where trip_id = $1 and student_id = $2',
        [t.id, f.studentId],
      )
    ).rows[0];
    if (ex) {
      await q.query('delete from trip_event where id = $1', [ex.id]);
      if (ex.kind === f.kind) {
        return { state: 'wait' };
      }
    }
    const hasFix = typeof f.lat === 'number' && typeof f.lng === 'number';
    const flag = !hasFix ? 'no_fix' : (f.accuracy ?? 0) > 100 ? 'low_accuracy' : null; // R-LOC-3
    await q.query(
      'insert into trip_event(id, trip_id, student_id, kind, at, lat, lng, accuracy, flag) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        uid('e'),
        t.id,
        f.studentId,
        f.kind,
        now.toISOString(),
        hasFix ? f.lat : null,
        hasFix ? f.lng : null,
        f.accuracy ?? null,
        flag,
      ],
    );
    return { state: f.kind };
  });
}

export async function children(q: Q, u: User) {
  need(u, 'attendance.set');
  return (
    await q.query('select id, name from student where guardian_id = $1 and status = $2 order by name', [u.id, 'active'])
  ).rows;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000; // ~100 m (R-LOC-5)

export async function parentTrip(q: Q, u: User, sid: string, dir: Direction, now: Date) {
  need(u, 'attendance.set');
  const s = await visibleStudent(q, u, sid);
  const date = ist(now).date;
  const t = await getTrip(q, s.vehicle_id, date, dir);
  const sign = dir === 'pickup' ? 1 : -1;
  const ord = (seq: number) => sign * seq;
  const stops = (
    await q.query<{ id: string; name: string; seq: number; typical: string | null }>(
      'select id, name, seq, typical from stop where vehicle_id = $1 order by seq',
      [s.vehicle_id],
    )
  ).rows;
  stops.sort((a, b) => ord(a.seq) - ord(b.seq));
  const my = stops.find((x) => x.id === s.stop_id);
  const ev = t
    ? (
        await q.query<{
          student_id: string;
          at: Date;
          seq: number | null;
          stop: string | null;
          lat: number | null;
          lng: number | null;
          accuracy: number | null;
        }>(
          `select e.student_id, e.at, st.seq, st.name as stop, e.lat, e.lng, e.accuracy from trip_event e join student x on x.id = e.student_id left join stop st on st.id = x.stop_id
           where e.trip_id = $1 and e.kind = 'boarded' order by e.at`,
          [t.id],
        )
      ).rows
    : [];
  const last = ev[ev.length - 1];
  const progress = ev.reduce((m, e) => Math.max(m, ord(e.seq ?? 0)), -Infinity);
  const me = ev.find((e) => e.student_id === sid);
  const away = my ? ord(my.seq) - progress - 1 : -1;
  const status = t ? t.status : 'idle';
  const intent = (
    await q.query<{ going: boolean }>(
      'select going from attendance_intent where student_id = $1 and trip_date = $2 and direction = $3',
      [sid, date, dir],
    )
  ).rows[0];
  const fix =
    last && last.lat != null && last.lng != null && (last.accuracy ?? 0) <= 100
      ? { lat: r3(last.lat), lng: r3(last.lng) }
      : undefined;
  return {
    direction: dir,
    going: intent ? intent.going : true,
    locked: !!t,
    status,
    picked: istTime(me?.at),
    typical: my?.typical ?? '',
    away:
      status === 'started' && !me && away >= 0 && ev.length > 0
        ? away
        : status === 'started' && !me && ev.length === 0
          ? Math.max(0, ord(my?.seq ?? 1) - 1)
          : null,
    last: last ? { stop: last.stop ?? '', at: istTime(last.at) ?? '' } : undefined,
    pin: fix,
    stops: stops.map((x) => ({
      name: x.name,
      done: !!t && progress !== -Infinity && ord(x.seq) <= progress,
      mine: x.id === s.stop_id,
      typical: x.typical ?? '',
    })),
  };
}

/** Parent says Going / Not going. Locked once the trip starts (R-ATT-3); after the cutoff it is accepted but flagged late for the driver (R-ATT-2). */
export async function setGoing(q: Q, u: User, sid: string, going: boolean, dir: Direction, now: Date) {
  need(u, 'attendance.set');
  const s = await visibleStudent(q, u, sid);
  const t = ist(now);
  if (await getTrip(q, s.vehicle_id, t.date, dir)) {
    throw new HttpError(409, 'Trip already started. Please call the driver.');
  }
  const late = t.time > cutoff(dir);
  await q.query(
    `insert into attendance_intent(student_id, trip_date, direction, going, is_late, set_at) values ($1,$2,$3,$4,$5,$6)
     on conflict (student_id, trip_date, direction) do update set going = $4, is_late = $5, set_at = $6`,
    [sid, t.date, dir, going, late, now.toISOString()],
  );
  return { late };
}

/* --------------------------------------------------------------------- admin */

export async function adminOverview(q: Q, u: User, now: Date) {
  need(u, 'admin.view');
  const date = ist(now).date;
  const vehicles = (
    await q.query<{
      id: string;
      label: string;
      cap: number;
      driverId: string;
      driver: string;
      active: boolean;
      used: number;
      outstanding: number;
      trip: string;
    }>(
      `select v.id, v.label, v.cap, dr.id as "driverId", dr.name as driver, dr.active,
              (select count(*)::int from student s where s.vehicle_id = v.id and s.status <> 'left') as used,
              (select coalesce(sum(${OUT}), 0)::int from fee_due d join student s2 on s2.id = d.student_id where s2.vehicle_id = v.id) as outstanding,
              coalesce((select case when bool_or(t.status = 'started') then 'started' when bool_or(t.status = 'ended') then 'ended' else 'idle' end from trip t where t.vehicle_id = v.id and t.trip_date = $1), 'idle') as trip
       from vehicle v left join app_user dr on dr.vehicle_id = v.id and dr.role = 'driver' order by v.id`,
      [date],
    )
  ).rows;
  const students = (await q.query<{ n: number }>("select count(*)::int as n from student where status <> 'left'"))
    .rows[0].n;
  return {
    students,
    outstanding: vehicles.reduce((x, v) => x + v.outstanding, 0),
    collected: await collectedToday(q, u, date),
    vehicles,
  };
}

export async function setDriverActive(q: Q, u: User, driverId: string, active: boolean) {
  need(u, 'drivers.manage');
  const r = await q.query("update app_user set active = $2 where id = $1 and role = 'driver' returning id", [
    driverId,
    active,
  ]);
  if (!r.rows[0]) {
    throw new HttpError(404, 'Not found');
  }
  await audit(q, u.id, active ? 'driver.activate' : 'driver.suspend', 'app_user', driverId);
}
