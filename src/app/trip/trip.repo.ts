import { Injectable, inject } from '@angular/core';

import { AuthService } from '../core/auth';
import { MockDb } from '../core/mock.db';

export type RState = 'wait' | 'boarded' | 'skipped' | 'off';
export interface TRow {
  id: string;
  name: string;
  stop: string;
  state: RState;
  at?: string;
}
export interface TState {
  status: 'idle' | 'started' | 'ended';
  startedAt?: string;
  endedAt?: string;
}
export interface PInfo {
  going: boolean;
  locked: boolean;
  status: TState['status'];
  picked?: string;
  away: number | null;
  typical: string;
  last?: { stop: string; at: string };
  stops: { name: string; done: boolean; mine: boolean; typical: string }[];
}

export abstract class TripRepo {
  // driver (own vehicle only)
  abstract roster(): Promise<TRow[]>;
  abstract state(): Promise<TState>;
  abstract start(): Promise<void>;
  abstract tap(sid: string): Promise<void>; // one tap = picked up; tap again = undo
  abstract notThere(sid: string): Promise<void>;
  abstract end(): Promise<void>;
  // parent (own children only)
  abstract children(): Promise<{ id: string; name: string }[]>;
  abstract parent(sid: string): Promise<PInfo>;
  abstract setGoing(sid: string, going: boolean): Promise<void>; // locked once the trip starts (R-ATT-3)
  // admin (read-only)
  abstract status(veh: string): Promise<TState>;
  abstract reset(): Promise<void>; // demo only
}

interface Ev {
  sid: string;
  st: 'boarded' | 'skipped';
  at: string;
  seq: number;
  stop: string;
}
interface Tr {
  status: TState['status'];
  startedAt?: string;
  endedAt?: string;
  ev: Ev[];
}

@Injectable()
export class MockTripRepo extends TripRepo {
  private db = inject(MockDb);
  private auth = inject(AuthService);
  private going: Record<string, boolean> = { s2: false }; // seed: one parent already said "not going"
  private tr: Record<string, Tr> = {};

  private T(v: string) {
    return (this.tr[v] ??= { status: 'idle', ev: [] });
  }
  private now() {
    return new Date().toTimeString().slice(0, 5);
  }
  private stu(sid: string) {
    return this.db.students.find((s) => s.id === sid);
  }
  private stop(id: string) {
    return this.db.stops.find((t) => t.id === id);
  }
  private drv() {
    this.auth.require('trip.run');
    return this.auth.session?.veh ?? '';
  }
  private own(sid: string) {
    this.auth.require('attendance.set');
    const s = this.stu(sid);
    if (!s || !this.auth.ownsChild(sid)) throw Error('Not allowed');
    return s;
  }

  async roster(): Promise<TRow[]> {
    const v = this.drv(),
      t = this.T(v);
    return this.db.students
      .filter((s) => s.veh === v && s.status === 'active')
      .map((s) => {
        const e = t.ev.find((x) => x.sid === s.id),
          st = this.stop(s.stop);
        return {
          id: s.id,
          name: s.name,
          stop: st?.name ?? '',
          seq: st?.seq ?? 99,
          state: (this.going[s.id] === false ? 'off' : e ? e.st : 'wait') as RState,
          at: e?.at,
        };
      })
      .sort((a, b) => a.seq - b.seq || a.name.localeCompare(b.name)) // route order (R-TRIP-2)
      .map((r) => ({ id: r.id, name: r.name, stop: r.stop, state: r.state, at: r.at }));
  }

  async state(): Promise<TState> {
    const t = this.T(this.drv());
    return { status: t.status, startedAt: t.startedAt, endedAt: t.endedAt };
  }

  async status(v: string): Promise<TState> {
    if (!(this.auth.can('admin.view') || this.auth.ownsVeh(v))) throw Error('Not allowed');
    const t = this.T(v);
    return { status: t.status, startedAt: t.startedAt, endedAt: t.endedAt };
  }

  async start(): Promise<void> {
    const t = this.T(this.drv());
    t.status = 'started';
    t.startedAt = this.now();
    t.ev = [];
  }

  async end(): Promise<void> {
    const t = this.T(this.drv());
    t.status = 'ended';
    t.endedAt = this.now();
  } // never blocked (R-TRIP-5)

  private toggle(sid: string, st: Ev['st']) {
    const v = this.drv(),
      s = this.stu(sid);
    if (!s || s.veh !== v) throw Error('Not allowed');
    const t = this.T(v);
    if (t.status !== 'started') throw Error('Start the trip first');
    if (this.going[sid] === false) return;
    const i = t.ev.findIndex((e) => e.sid === sid),
      same = i >= 0 && t.ev[i].st === st;
    if (i >= 0) t.ev.splice(i, 1);
    if (!same) {
      const p = this.stop(s.stop);
      t.ev.push({ sid, st, at: this.now(), seq: p?.seq ?? 0, stop: p?.name ?? '' });
    }
  }

  async tap(sid: string): Promise<void> {
    this.toggle(sid, 'boarded');
  }

  async notThere(sid: string): Promise<void> {
    this.toggle(sid, 'skipped');
  }

  async children(): Promise<{ id: string; name: string }[]> {
    this.auth.require('attendance.set');
    return this.db.students.filter((s) => this.auth.ownsChild(s.id)).map((s) => ({ id: s.id, name: s.name }));
  }

  async setGoing(sid: string, g: boolean): Promise<void> {
    const s = this.own(sid);
    if (this.T(s.veh).status === 'started') throw Error('Trip already started. Please call the driver.');
    this.going[sid] = g;
  }

  async parent(sid: string): Promise<PInfo> {
    const s = this.own(sid),
      t = this.T(s.veh),
      my = this.stop(s.stop),
      b = t.ev.filter((e) => e.st === 'boarded'),
      last = b[b.length - 1];
    const lastSeq = b.reduce((m, e) => Math.max(m, e.seq), 0),
      me = b.find((e) => e.sid === sid),
      a = my ? my.seq - lastSeq - 1 : -1;
    return {
      going: this.going[sid] !== false,
      locked: t.status !== 'idle',
      status: t.status,
      picked: me?.at,
      typical: my?.typical ?? '',
      away: t.status === 'started' && !me && a >= 0 ? a : null,
      last: last ? { stop: last.stop, at: last.at } : undefined,
      stops: this.db.stops
        .filter((x) => x.veh === s.veh)
        .sort((x, y) => x.seq - y.seq)
        .map((x) => ({
          name: x.name,
          done: t.status !== 'idle' && x.seq <= lastSeq,
          mine: x.id === s.stop,
          typical: x.typical,
        })),
    };
  }

  async reset(): Promise<void> {
    this.tr = {};
    this.going = { s2: false };
  }
}
