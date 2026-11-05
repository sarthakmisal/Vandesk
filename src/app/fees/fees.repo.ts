import { Injectable, inject } from '@angular/core';

import { AuthService } from '../core/auth';
import { MockDb } from '../core/mock.db';

import type { Mode, Row, Statement } from './fees.models';

/** Contract the UI depends on. Replace MockFeesRepo with an HTTP implementation later; nothing else changes. */
export abstract class FeesRepo {
  abstract list(): Promise<Row[]>; // students (in my scope) with pending fees, oldest first
  abstract collectedToday(): Promise<number>;
  abstract record(studentId: string, amount: number, mode: Mode): Promise<string>; // driver only, own vehicle
  abstract undo(paymentId: string): Promise<void>; // writes a reversal, never deletes
  abstract statement(studentId: string): Promise<Statement>; // read-only, parent sees own child only
}

interface Due {
  id: string;
  sid: string;
  per: string;
  amt: number;
}
interface Pay {
  id: string;
  sid: string;
  kind: 'payment' | 'reversal';
  amt: number;
  mode: Mode;
  on: string;
  rev?: string;
}
interface Al {
  pid: string;
  did: string;
  amt: number;
}

const PER = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

@Injectable()
export class MockFeesRepo extends FeesRepo {
  private db = inject(MockDb);
  private auth = inject(AuthService);
  private TODAY = '2026-10-21';
  private n = 0;
  private dues: Due[] = [];
  private pay: Pay[] = [];
  private al: Al[] = [];

  constructor() {
    super();
    this.sync();
    (
      [
        ['s1', 150000],
        ['s2', 60000],
        ['s3', 90000],
        ['s4', 30000],
        ['s6', 120000],
      ] as [string, number][]
    ).forEach(([sid, a]) => this.apply(sid, a, 'cash', '2026-09-12'));
  }

  /** Idempotent due generation: new students get dues from their join month (full month, R-FEE-4). */
  private sync() {
    this.db.students
      .filter((s) => s.status === 'active')
      .forEach((s) =>
        PER.filter((p) => p >= s.joined).forEach((per) => {
          const id = `d${s.id}${per}`;
          if (!this.dues.some((d) => d.id === id)) this.dues.push({ id, sid: s.id, per, amt: 30000 });
        }),
      );
  }

  private paid = (d: Due) => this.al.filter((a) => a.did === d.id).reduce((x, a) => x + a.amt, 0);
  private open = (sid: string) =>
    this.dues.filter((d) => d.sid === sid && d.amt - this.paid(d) > 0).sort((a, b) => (a.per < b.per ? -1 : 1));
  private stu = (sid: string) => this.db.students.find((x) => x.id === sid);

  private apply(sid: string, amt: number, mode: Mode, on: string) {
    const id = 'p' + ++this.n;
    this.pay.push({ id, sid, kind: 'payment', amt, mode, on });
    let l = amt;
    for (const d of this.open(sid)) {
      const t = Math.min(l, d.amt - this.paid(d));
      this.al.push({ pid: id, did: d.id, amt: t });
      l -= t;
      if (l <= 0) break;
    }
    return id;
  }

  private writable(sid: string) {
    this.auth.require('fees.record');
    const s = this.stu(sid);
    if (!s || !this.auth.ownsVeh(s.veh)) throw Error('Not allowed');
  }

  async list(): Promise<Row[]> {
    this.auth.require('fees.read');
    this.sync();
    return this.db.students
      .filter((s) => s.status === 'active' && this.auth.canSee(s))
      .map((s) => {
        const o = this.open(s.id);
        let c = 0;
        const steps = o.map((d) => (c += d.amt - this.paid(d)));
        return {
          id: s.id,
          name: s.name,
          cls: s.cls,
          vehicle: this.db.vehicles.find((v) => v.id === s.veh)?.short ?? '',
          veh: s.veh,
          months: o.length,
          balance: c,
          steps,
          since: o[0]?.per ?? '',
        };
      })
      .filter((r) => r.balance > 0)
      .sort((a, b) => (a.since < b.since ? -1 : 1));
  }

  async collectedToday(): Promise<number> {
    this.auth.require('fees.read');
    return this.pay
      .filter((p) => {
        const s = this.stu(p.sid);
        return p.on === this.TODAY && !!s && this.auth.canSee(s);
      })
      .reduce((x, p) => x + (p.kind === 'payment' ? p.amt : -p.amt), 0);
  }

  async record(sid: string, amount: number, mode: Mode): Promise<string> {
    this.writable(sid);
    if (!(amount > 0)) throw Error('amount');
    return this.apply(sid, amount, mode, this.TODAY);
  }

  async undo(pid: string): Promise<void> {
    const o = this.pay.find((p) => p.id === pid);
    if (!o) return;
    this.writable(o.sid);
    if (this.pay.some((p) => p.rev === pid)) return;
    const r = 'p' + ++this.n;
    this.pay.push({ id: r, sid: o.sid, kind: 'reversal', amt: o.amt, mode: o.mode, on: this.TODAY, rev: pid });
    this.al.filter((a) => a.pid === pid).forEach((a) => this.al.push({ pid: r, did: a.did, amt: -a.amt }));
  }

  async statement(sid: string): Promise<Statement> {
    this.auth.require('fees.read');
    const s = this.stu(sid);
    if (!s || !this.auth.canSee(s)) throw Error('Not allowed');
    this.sync();
    const rows = this.dues
      .filter((d) => d.sid === sid)
      .sort((a, b) => (a.per < b.per ? -1 : 1))
      .map((d) => ({ per: d.per, amt: d.amt, paid: this.paid(d) }));
    return { name: s.name, balance: rows.reduce((x, r) => x + r.amt - r.paid, 0), rows };
  }
}
