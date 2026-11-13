import type { Db } from './db.ts';
import { applyPayment, generateDues } from './domain.ts';
import { ist } from './time.ts';

/** Demo data (same people as the mock): 2 vehicles, 2 drivers, 6 guardians, 7 students, fee plan Rs 300/month from June 2026. */
export async function seedDemo(db: Db, now: Date) {
  if ((await db.query<{ n: number }>('select count(*)::int as n from app_user')).rows[0].n > 0) {
    return false;
  }
  await db.tx(async (q) => {
    await q.query(
      "insert into vehicle values ('v1','Van · MH-20 AB 1234','Van',6), ('v2','Mini bus · MH-20 CD 5678','Bus',14)",
    );
    await q.query(`insert into stop(id, vehicle_id, name, seq, typical) values
      ('t1','v1','Hanuman Mandir',1,'07:05'), ('t2','v1','Ganpati Mandir',2,'07:15'), ('t3','v1','Garden Chowk',3,'07:25'), ('t4','v1','Bus Stand',4,'07:35'),
      ('t5','v2','Station Road',1,'07:10'), ('t6','v2','Market Yard',2,'07:25')`);
    await q.query(`insert into app_user(id, email, name, role, vehicle_id) values
      ('admin','admin@vandesk.test','VanDesk Admin','admin',null),
      ('u1','ramesh@vandesk.test','Ramesh Kale','driver','v1'), ('u2','suresh@vandesk.test','Suresh Wagh','driver','v2')`);
    const guardians = ['Mr. Patil', 'Mrs. Joshi', 'Mrs. Kulkarni', 'Mrs. More', 'Mrs. Naik', 'Mr. Sinha'];
    for (const [i, g] of guardians.entries()) {
      await q.query("insert into app_user(id, email, name, role, phone) values ($1,$2,$3,'parent',$4)", [
        `g${i + 1}`,
        g.replace(/\W+/g, '').toLowerCase() + '@mail.test',
        g,
        `9820000${100 + i}`,
      ]);
    }
    await q.query(
      "insert into fee_plan(id, vehicle_id, amount, effective_from) values ('f1','v1',30000,'2026-06-01'), ('f2','v2',30000,'2026-06-01')",
    );
    const students: [string, string, string, string, string, string][] = [
      ['s1', 'Akshay Patil', '5', 'v1', 't1', 'g1'],
      ['s2', 'Ishita Patil', '3', 'v1', 't1', 'g1'],
      ['s3', 'Karthik Joshi', '6', 'v1', 't2', 'g2'],
      ['s4', 'Harsha Kulkarni', '7', 'v1', 't3', 'g3'],
      ['s5', 'Rohan More', '8', 'v1', 't3', 'g4'],
      ['s6', 'Diya Naik', '4', 'v2', 't5', 'g5'],
      ['s7', 'Kabir Sinha', '6', 'v2', 't6', 'g6'],
    ];
    const joined: Record<string, string> = { s4: '2026-08', s7: '2026-07' };
    for (const [id, name, cls, veh, stop, g] of students) {
      await q.query(
        'insert into student(id, name, cls, vehicle_id, stop_id, guardian_id, joined) values ($1,$2,$3,$4,$5,$6,$7)',
        [id, name, cls, veh, stop, g, joined[id] ?? '2026-06'],
      );
    }
    // backfill dues from June 2026 up to the current month, then record some payments
    const cur = ist(now).period;
    for (let y = 2026, m = 6; `${y}-${String(m).padStart(2, '0')}` <= cur; m === 12 ? (y++, (m = 1)) : m++) {
      await generateDues(q, `${y}-${String(m).padStart(2, '0')}`);
    }
    for (const [sid, amt] of [
      ['s1', 150000],
      ['s2', 60000],
      ['s3', 90000],
      ['s4', 30000],
      ['s6', 120000],
    ] as const) {
      await applyPayment(q, sid, amt, 'cash', '2026-09-12', 'u1', null);
    }
  });
  return true;
}
