import { Injectable } from '@angular/core';
import { Mode, Row } from './fees.models';

/** Contract the UI depends on. Replace MockFeesRepo with an HTTP implementation later; nothing else changes. */
export abstract class FeesRepo {
  abstract list(): Promise<Row[]>;                       // students with pending fees, oldest first
  abstract collectedToday(): Promise<number>;
  abstract record(studentId: string, amount: number, mode: Mode): Promise<string>; // returns payment id
  abstract undo(paymentId: string): Promise<void>;       // writes a reversal, never deletes
}

interface Due { id: string; sid: string; per: string; amt: number }
interface Pay { id: string; sid: string; kind: 'payment' | 'reversal'; amt: number; mode: Mode; on: string; rev?: string }
interface Al { pid: string; did: string; amt: number }

@Injectable()
export class MockFeesRepo extends FeesRepo {
  private TODAY = '2026-10-21'; private n = 0;
  // tables mirror: student, fee_due, payment, payment_allocation
  private st = [['s1', 'Akshay Patil', '5', 'Van', '2026-06'], ['s2', 'Ishita Patil', '3', 'Van', '2026-06'], ['s3', 'Karthik Joshi', '6', 'Van', '2026-06'],
    ['s4', 'Harsha Kulkarni', '7', 'Van', '2026-08'], ['s5', 'Rohan More', '8', 'Van', '2026-06'], ['s6', 'Diya Naik', '4', 'Bus', '2026-06'], ['s7', 'Kabir Sinha', '6', 'Bus', '2026-07']]
    .map(([id, name, cls, vehicle, from]) => ({ id, name, cls, vehicle, from }));
  private dues: Due[] = []; private pay: Pay[] = []; private al: Al[] = [];

  constructor() {
    super();
    const P = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    this.st.forEach(s => P.filter(p => p >= s.from).forEach(per => this.dues.push({ id: `d${s.id}${per}`, sid: s.id, per, amt: 30000 })));
    [['s1', 150000], ['s2', 60000], ['s3', 90000], ['s4', 30000], ['s6', 120000]].forEach(([sid, a]) => this.apply(sid as string, a as number, 'cash', '2026-09-12'));
  }
  private paid = (d: Due) => this.al.filter(a => a.did === d.id).reduce((x, a) => x + a.amt, 0);
  private open = (sid: string) => this.dues.filter(d => d.sid === sid && d.amt - this.paid(d) > 0).sort((a, b) => (a.per < b.per ? -1 : 1));
  private apply(sid: string, amt: number, mode: Mode, on: string) {
    const id = 'p' + ++this.n; this.pay.push({ id, sid, kind: 'payment', amt, mode, on });
    let l = amt; for (const d of this.open(sid)) { const t = Math.min(l, d.amt - this.paid(d)); this.al.push({ pid: id, did: d.id, amt: t }); l -= t; if (l <= 0) break; }
    return id;
  }
  async list() {
    return this.st.map(s => { const o = this.open(s.id); let c = 0; const steps = o.map(d => (c += d.amt - this.paid(d)));
      return { id: s.id, name: s.name, cls: s.cls, vehicle: s.vehicle, months: o.length, balance: c, steps, since: o[0]?.per ?? '' } as Row; })
      .filter(r => r.balance > 0).sort((a, b) => (a.since < b.since ? -1 : 1));
  }
  async collectedToday() { return this.pay.filter(p => p.on === this.TODAY).reduce((x, p) => x + (p.kind === 'payment' ? p.amt : -p.amt), 0); }
  async record(sid: string, amount: number, mode: Mode) { if (!(amount > 0)) throw Error('amount'); return this.apply(sid, amount, mode, this.TODAY); }
  async undo(pid: string) {
    const o = this.pay.find(p => p.id === pid); if (!o || this.pay.some(p => p.rev === pid)) return;
    const r = 'p' + ++this.n; this.pay.push({ id: r, sid: o.sid, kind: 'reversal', amt: o.amt, mode: o.mode, on: this.TODAY, rev: pid });
    this.al.filter(a => a.pid === pid).forEach(a => this.al.push({ pid: r, did: a.did, amt: -a.amt }));
  }
}
