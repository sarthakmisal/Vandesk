import type { Direction } from '../core/direction';

import type { TRow } from './trip.repo';

export interface TripPlan {
  /** The one student on screen right now. */
  current?: TRow;
  /** Who comes after (shown small, so the driver knows what is coming). */
  next?: TRow;
  done: number;
  skipped: number;
  /** Students who are riding today (parents' "Not going" never appear). */
  total: number;
  /** 1-based position of `current` for "3 of 7". */
  position: number;
}

/**
 * The order the van reaches the stops: the pickup run goes from the first stop to the last,
 * the drop run drives the same route in reverse (last stop first). Students at the same stop stay together (by name).
 */
export function routeOrder(rows: TRow[], dir: Direction): TRow[] {
  const sign = dir === 'pickup' ? 1 : -1;
  return [...rows].sort((a, b) => sign * (a.seq - b.seq) || a.name.localeCompare(b.name));
}

/**
 * "Who is next" rule. The driver never chooses from a list: the next student is simply the first one,
 * in route order, who has not been picked up (or dropped) yet. Marking someone done or "not here" moves on automatically;
 * undo puts them back as the current student because they are earlier on the route than everyone still waiting.
 */
export function planTrip(rows: TRow[], dir: Direction): TripPlan {
  const riding = routeOrder(rows, dir).filter((r) => r.state !== 'off');
  const waiting = riding.filter((r) => r.state === 'wait');
  const done = riding.filter((r) => r.state === 'boarded').length;
  const skipped = riding.filter((r) => r.state === 'skipped').length;
  return {
    current: waiting[0],
    next: waiting[1],
    done,
    skipped,
    total: riding.length,
    position: Math.min(done + skipped + 1, riding.length),
  };
}
