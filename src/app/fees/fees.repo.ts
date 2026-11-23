import { Injectable, inject } from '@angular/core';

import { AuthService } from '../core/auth.service';
import { MockDb } from '../core/mock-db';

import type { LedgerRow, Mode, PlanRow, RemindResult, Row, Statement } from './fees.models';

/** Contract the UI depends on. Replace MockFeesRepo with an HTTP implementation later; nothing else changes. */
export abstract class FeesRepo {
  /** Students (in my scope) with pending fees, oldest first. */
  abstract list(): Promise<Row[]>;
  abstract collectedToday(): Promise<number>;
  /** Driver only, own vehicle. Returns the payment id. */
  abstract record(studentId: string, amount: number, mode: Mode): Promise<string>;
  /** Writes a reversal row with a reason (R-PAY-1); the original is never edited or deleted. */
  abstract reverse(paymentId: string, note: string): Promise<void>;
  /** Payments and reversals in my scope, newest first. */
  abstract ledger(): Promise<LedgerRow[]>;
  /** Monthly fee plans in my scope, newest first. */
  abstract plans(): Promise<PlanRow[]>;
  /** New plan from a date; dues already generated never change. Driver, own vehicle. */
  abstract addPlan(amount: number, from: string): Promise<void>;
  /** Email fee reminders to guardians with a balance (once per student per day). Driver, own vehicle. */
  abstract remind(): Promise<RemindResult>;
  /** Read-only. A parent sees own child only. */
  abstract statement(studentId: string): Promise<Statement>;
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
  note?: string;
}
interface Alloc {
  pid: string;
  did: string;
  amt: number;
}

const PERIODS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

@Injectable()
export class MockFeesRepo extends FeesRepo {
  private readonly db = inject(MockDb);
  private readonly auth = inject(AuthService);
  private readonly TODAY = '2026-10-21';
  private n = 0;
  private readonly dues: Due[] = [];
  private readonly pay: Pay[] = [];
  private readonly al: Alloc[] = [];
  private readonly plan: PlanRow[] = [
    { id: 'f1', veh: 'v1', amount: 30000, effective_from: '2026-06-01' },
    { id: 'f2', veh: 'v2', amount: 30000, effective_from: '2026-06-01' },
  ];
  private readonly reminded = new Set<string>();

  constructor() {
    super();
    this.sync();
    const seed: [string, number][] = [
      ['s1', 150000],
      ['s2', 60000],
      ['s3', 90000],
      ['s4', 30000],
      ['s6', 120000],
    ];
    seed.forEach(([sid, amt]) => this.apply(sid, amt, 'cash', '2026-09-12'));
  }

  async list(): Promise<Row[]> {
    this.auth.require('fees.read');
    this.sync();
    return this.db.students
      .filter((s) => s.status === 'active' && this.auth.canSee(s))
      .map((s) => {
        const open = this.open(s.id);
        let running = 0;
        const steps = open.map((d) => (running += d.amt - this.paid(d)));
        return {
          id: s.id,
          name: s.name,
          cls: s.cls,
          vehicle: this.db.vehicles.find((v) => v.id === s.veh)?.short ?? '',
          veh: s.veh,
          months: open.length,
          balance: running,
          steps,
          since: open[0]?.per ?? '',
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
    if (!(amount > 0)) {
      throw new Error('Enter an amount');
    }
    return this.apply(sid, amount, mode, this.TODAY);
  }

  async reverse(pid: string, note: string): Promise<void> {
    this.auth.require('fees.record');
    if (!note.trim()) {
      throw new Error('A reason is required');
    }
    const orig = this.pay.find((p) => p.id === pid && p.kind === 'payment');
    if (!orig) {
      throw new Error('Payment not found');
    }
    this.writable(orig.sid);
    if (this.pay.some((p) => p.rev === pid)) {
      throw new Error('Already reversed');
    }
    const id = 'p' + ++this.n;
    this.pay.push({
      id,
      sid: orig.sid,
      kind: 'reversal',
      amt: orig.amt,
      mode: orig.mode,
      on: this.TODAY,
      rev: pid,
      note: note.trim(),
    });
    this.al.filter((a) => a.pid === pid).forEach((a) => this.al.push({ pid: id, did: a.did, amt: -a.amt }));
  }

  async ledger(): Promise<LedgerRow[]> {
    this.auth.require('fees.read');
    return this.pay
      .filter((p) => {
        const s = this.stu(p.sid);
        return !!s && this.auth.canSee(s);
      })
      .map((p) => ({
        id: p.id,
        student: this.stu(p.sid)!.name,
        kind: p.kind,
        amount: p.amt,
        mode: p.mode,
        paid_on: p.on,
        note: p.note ?? '',
        reversed: this.pay.some((r) => r.rev === p.id),
      }))
      .reverse();
  }

  async plans(): Promise<PlanRow[]> {
    this.auth.require('fees.read');
    return this.plan
      .filter((p) => this.auth.session()?.role === 'admin' || this.auth.ownsVeh(p.veh))
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  }

  async addPlan(amount: number, from: string): Promise<void> {
    this.auth.require('fees.record');
    this.pushPlan(this.auth.session()!.veh!, amount, from);
  }

  /** Admin (mock): any vehicle. The real API does the same on POST /admin/vehicles/:id/fee-plans. */
  setFee(veh: string, amount: number, from: string): void {
    this.auth.require('fees.plan');
    this.pushPlan(veh, amount, from);
  }

  /** Monthly fee in force today for a vehicle (paise), or 0 when none is set. */
  feeNow(veh: string): number {
    return this.amountFor(veh, this.TODAY.slice(0, 7));
  }

  private pushPlan(veh: string, amount: number, from: string): void {
    if (!(amount > 0) || !from) {
      throw new Error('Enter amount and date');
    }
    const last = this.plan
      .filter((p) => p.veh === veh)
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
    if (last && from <= last.effective_from) {
      throw new Error('Start date must be after the current plan starts');
    }
    this.plan.push({ id: 'f' + ++this.n, veh, amount, effective_from: from });
  }

  async remind(): Promise<RemindResult> {
    this.auth.require('fees.record');
    const out = { sent: 0, skipped: 0, failed: 0 };
    for (const r of await this.list()) {
      const key = `rem:${r.id}:${this.TODAY}`;
      if (this.reminded.has(key)) {
        out.skipped += 1;
      } else {
        this.reminded.add(key);
        out.sent += 1;
      }
    }
    return out;
  }

  async statement(sid: string): Promise<Statement> {
    this.auth.require('fees.read');
    const s = this.stu(sid);
    if (!s || !this.auth.canSee(s)) {
      throw new Error('Not allowed');
    }
    this.sync();
    const rows = this.dues
      .filter((d) => d.sid === sid)
      .sort((a, b) => (a.per < b.per ? -1 : 1))
      .map((d) => ({ per: d.per, amt: d.amt, paid: this.paid(d) }));
    return { name: s.name, balance: rows.reduce((x, r) => x + r.amt - r.paid, 0), rows };
  }

  /** Idempotent due generation: new students get dues from their join month (full month, R-FEE-4). */
  private sync(): void {
    this.db.students
      .filter((s) => s.status === 'active')
      .forEach((s) =>
        PERIODS.filter((p) => p >= s.joined).forEach((per) => {
          const id = `d${s.id}${per}`;
          if (!this.dues.some((d) => d.id === id)) {
            this.dues.push({ id, sid: s.id, per, amt: this.amountFor(s.veh, per) });
          }
        }),
      );
  }

  /** Plan in force for a vehicle in a month (latest plan starting on or before it). */
  private amountFor(veh: string, per: string): number {
    const p = this.plan
      .filter((x) => x.veh === veh && x.effective_from <= per + '-01')
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
    return p?.amount ?? 0;
  }

  private paid(d: Due): number {
    return this.al.filter((a) => a.did === d.id).reduce((x, a) => x + a.amt, 0);
  }

  private open(sid: string): Due[] {
    return this.dues.filter((d) => d.sid === sid && d.amt - this.paid(d) > 0).sort((a, b) => (a.per < b.per ? -1 : 1));
  }

  private stu(sid: string) {
    return this.db.students.find((x) => x.id === sid);
  }

  /** Oldest due first (R-PAY-2). */
  private apply(sid: string, amt: number, mode: Mode, on: string): string {
    const id = 'p' + ++this.n;
    this.pay.push({ id, sid, kind: 'payment', amt, mode, on });
    let left = amt;
    for (const d of this.open(sid)) {
      const take = Math.min(left, d.amt - this.paid(d));
      this.al.push({ pid: id, did: d.id, amt: take });
      left -= take;
      if (left <= 0) {
        break;
      }
    }
    return id;
  }

  private writable(sid: string): void {
    this.auth.require('fees.record');
    const s = this.stu(sid);
    if (!s || !this.auth.ownsVeh(s.veh)) {
      throw new Error('Not allowed');
    }
  }
}
