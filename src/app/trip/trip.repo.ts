import { Injectable, inject } from '@angular/core';

import { AuthService } from '../core/auth.service';
import type { Direction } from '../core/direction';
import type { Fix } from '../core/geo';
import { MockDb } from '../core/mock-db';

export type RState = 'wait' | 'boarded' | 'skipped' | 'off';
export interface TRow {
  id: string;
  name: string;
  stop: string;
  state: RState;
  at?: string;
  /** Parent changed to Not going after the cutoff (driver sees a badge). */
  late?: boolean;
}
export interface TState {
  status: 'idle' | 'started' | 'ended';
  startedAt?: string;
  endedAt?: string;
}
export interface PInfo {
  direction: Direction;
  going: boolean;
  locked: boolean;
  status: TState['status'];
  picked?: string;
  away: number | null;
  typical: string;
  last?: { stop: string; at: string };
  /** Last stop location, rounded to about 100 m (R-LOC-5). Only when the fix was accurate. */
  pin?: { lat: number; lng: number };
  stops: { name: string; done: boolean; mine: boolean; typical: string }[];
}

export abstract class TripRepo {
  // driver (own vehicle only)
  abstract roster(dir: Direction): Promise<TRow[]>;
  abstract state(dir: Direction): Promise<TState>;
  abstract start(dir: Direction): Promise<void>;
  /** One tap = picked up (or dropped); tap again = undo. Location is captured at the tap, never in the background. */
  abstract tap(sid: string, dir: Direction, fix?: Fix): Promise<void>;
  abstract notThere(sid: string, dir: Direction): Promise<void>;
  abstract end(dir: Direction): Promise<void>;
  // parent (own children only)
  abstract children(): Promise<{ id: string; name: string }[]>;
  abstract parent(sid: string, dir: Direction): Promise<PInfo>;
  /** Locked once the trip starts (R-ATT-3). */
  abstract setGoing(sid: string, going: boolean, dir: Direction): Promise<void>;
  /** Demo only (mock mode). */
  abstract reset(): Promise<void>;
}

interface Ev {
  sid: string;
  st: 'boarded' | 'skipped';
  at: string;
  seq: number;
  stop: string;
}
interface Trip {
  status: TState['status'];
  startedAt?: string;
  endedAt?: string;
  ev: Ev[];
}

@Injectable()
export class MockTripRepo extends TripRepo {
  private readonly db = inject(MockDb);
  private readonly auth = inject(AuthService);
  private going: Record<string, boolean> = { 's2:pickup': false }; // seed: one parent already said "not going"
  private trips: Record<string, Trip> = {};

  async roster(dir: Direction): Promise<TRow[]> {
    const v = this.drv();
    const t = this.trip(v, dir);
    const sign = dir === 'pickup' ? 1 : -1; // the drop run visits the route in reverse
    return this.db.students
      .filter((s) => s.veh === v && s.status === 'active')
      .map((s) => {
        const e = t.ev.find((x) => x.sid === s.id);
        const st = this.stop(s.stop);
        const state: RState = this.going[`${s.id}:${dir}`] === false ? 'off' : e ? e.st : 'wait';
        return { row: { id: s.id, name: s.name, stop: st?.name ?? '', state, at: e?.at }, seq: st?.seq ?? 99 };
      })
      .sort((a, b) => sign * (a.seq - b.seq) || a.row.name.localeCompare(b.row.name)) // route order (R-TRIP-2)
      .map((x) => x.row);
  }

  async state(dir: Direction): Promise<TState> {
    return this.view(this.trip(this.drv(), dir));
  }

  /** Mock admin overview reads this directly. */
  adminStatus(veh: string): TState {
    const run = (['pickup', 'drop'] as const).map((d) => this.trip(veh, d).status);
    return { status: run.includes('started') ? 'started' : run.includes('ended') ? 'ended' : 'idle' };
  }

  async start(dir: Direction): Promise<void> {
    const t = this.trip(this.drv(), dir);
    t.status = 'started';
    t.startedAt = this.now();
    t.ev = [];
  }

  /** Never blocked, even with unmarked students (R-TRIP-5). */
  async end(dir: Direction): Promise<void> {
    const t = this.trip(this.drv(), dir);
    t.status = 'ended';
    t.endedAt = this.now();
  }

  async tap(sid: string, dir: Direction): Promise<void> {
    this.toggle(sid, dir, 'boarded');
  }

  async notThere(sid: string, dir: Direction): Promise<void> {
    this.toggle(sid, dir, 'skipped');
  }

  async children(): Promise<{ id: string; name: string }[]> {
    this.auth.require('attendance.set');
    return this.db.students.filter((s) => this.auth.ownsChild(s.id)).map((s) => ({ id: s.id, name: s.name }));
  }

  async setGoing(sid: string, going: boolean, dir: Direction): Promise<void> {
    const s = this.own(sid);
    if (this.trip(s.veh, dir).status !== 'idle') {
      throw new Error('Trip already started. Please call the driver.');
    }
    this.going[`${sid}:${dir}`] = going;
  }

  async parent(sid: string, dir: Direction): Promise<PInfo> {
    const s = this.own(sid);
    const t = this.trip(s.veh, dir);
    const sign = dir === 'pickup' ? 1 : -1;
    const ord = (seq: number) => sign * seq;
    const my = this.stop(s.stop);
    const boarded = t.ev.filter((e) => e.st === 'boarded');
    const last = boarded[boarded.length - 1];
    const progress = boarded.reduce((m, e) => Math.max(m, ord(e.seq)), -Infinity);
    const me = boarded.find((e) => e.sid === sid);
    const maxSeq = this.db.stops.filter((x) => x.veh === s.veh).reduce((m, x) => Math.max(m, x.seq), 0);
    const base = boarded.length ? progress : dir === 'pickup' ? 0 : -(maxSeq + 1); // before the first stop of this run
    const away = my ? ord(my.seq) - base - 1 : -1;
    return {
      direction: dir,
      going: this.going[`${sid}:${dir}`] !== false,
      locked: t.status !== 'idle',
      status: t.status,
      picked: me?.at,
      typical: my?.typical ?? '',
      away: t.status === 'started' && !me && away >= 0 ? away : null,
      last: last ? { stop: last.stop, at: last.at } : undefined,
      stops: this.db.stops
        .filter((x) => x.veh === s.veh)
        .sort((x, y) => ord(x.seq) - ord(y.seq))
        .map((x) => ({
          name: x.name,
          done: t.status !== 'idle' && boarded.length > 0 && ord(x.seq) <= progress,
          mine: x.id === s.stop,
          typical: x.typical,
        })),
    };
  }

  async reset(): Promise<void> {
    this.trips = {};
    this.going = { 's2:pickup': false };
  }

  private trip(v: string, dir: Direction): Trip {
    return (this.trips[`${v}:${dir}`] ??= { status: 'idle', ev: [] });
  }

  private view(t: Trip): TState {
    return { status: t.status, startedAt: t.startedAt, endedAt: t.endedAt };
  }

  private now(): string {
    return new Date().toTimeString().slice(0, 5);
  }

  private stop(id: string) {
    return this.db.stops.find((t) => t.id === id);
  }

  private drv(): string {
    this.auth.require('trip.run');
    return this.auth.session()!.veh!;
  }

  private own(sid: string) {
    this.auth.require('attendance.set');
    const s = this.db.students.find((x) => x.id === sid);
    if (!s || !this.auth.ownsChild(sid)) {
      throw new Error('Not allowed');
    }
    return s;
  }

  private toggle(sid: string, dir: Direction, st: Ev['st']): void {
    const v = this.drv();
    const s = this.db.students.find((x) => x.id === sid);
    if (!s || s.veh !== v) {
      throw new Error('Not allowed');
    }
    const t = this.trip(v, dir);
    if (t.status !== 'started') {
      throw new Error('Start the trip first');
    }
    if (this.going[`${sid}:${dir}`] === false) {
      return;
    }
    const i = t.ev.findIndex((e) => e.sid === sid);
    const same = i >= 0 && t.ev[i].st === st;
    if (i >= 0) {
      t.ev.splice(i, 1);
    }
    if (!same) {
      const p = this.stop(s.stop);
      t.ev.push({ sid, st, at: this.now(), seq: p?.seq ?? 0, stop: p?.name ?? '' });
    }
  }
}
