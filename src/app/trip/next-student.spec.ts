import { planTrip, routeOrder } from './next-student';
import type { RState, TRow } from './trip.repo';

const row = (id: string, name: string, seq: number, state: RState = 'wait'): TRow => ({
  id,
  name,
  stop: 'stop ' + seq,
  seq,
  state,
});

describe('who is next', () => {
  const rows = [row('c', 'Charu', 3), row('a', 'Akshay', 1), row('i', 'Ishita', 1), row('b', 'Bhavna', 2)];

  it('pickup goes from the first stop to the last, siblings at one stop together', () => {
    expect(routeOrder(rows, 'pickup').map((r) => r.name)).toEqual(['Akshay', 'Ishita', 'Bhavna', 'Charu']);
  });

  it('drop drives the route in reverse', () => {
    expect(routeOrder(rows, 'drop').map((r) => r.name)).toEqual(['Charu', 'Bhavna', 'Akshay', 'Ishita']);
  });

  it('shows exactly one current student, then the next in line', () => {
    const p = planTrip(rows, 'pickup');
    expect(p.current?.name).toBe('Akshay');
    expect(p.next?.name).toBe('Ishita');
    expect(p.total).toBe(4);
    expect(p.position).toBe(1);
  });

  it('advances automatically as students are picked up', () => {
    const after = rows.map((r) => (r.id === 'a' ? { ...r, state: 'boarded' as RState } : r));
    const p = planTrip(after, 'pickup');
    expect(p.current?.name).toBe('Ishita');
    expect(p.done).toBe(1);
    expect(p.position).toBe(2);
  });

  it('never shows students whose parents said Not going', () => {
    const off = rows.map((r) => (r.id === 'a' ? { ...r, state: 'off' as RState } : r));
    const p = planTrip(off, 'pickup');
    expect(p.current?.name).toBe('Ishita');
    expect(p.total).toBe(3);
  });

  it('moves on after "not here" and does not bring that student back', () => {
    const skipped = rows.map((r) => (r.id === 'a' ? { ...r, state: 'skipped' as RState } : r));
    const p = planTrip(skipped, 'pickup');
    expect(p.current?.name).toBe('Ishita');
    expect(p.skipped).toBe(1);
  });

  it('undo puts the student straight back as current (earlier on the route than everyone waiting)', () => {
    const marked = rows.map((r) => (r.id === 'a' || r.id === 'i' ? { ...r, state: 'boarded' as RState } : r));
    expect(planTrip(marked, 'pickup').current?.name).toBe('Bhavna');
    const undone = marked.map((r) => (r.id === 'i' ? { ...r, state: 'wait' as RState } : r));
    expect(planTrip(undone, 'pickup').current?.name).toBe('Ishita');
  });

  it('has no current student when everyone is done', () => {
    const all = rows.map((r) => ({ ...r, state: 'boarded' as RState }));
    const p = planTrip(all, 'pickup');
    expect(p.current).toBeUndefined();
    expect(p.done).toBe(4);
    expect(p.position).toBe(4);
  });

  it('does not depend on the order the server sends the rows', () => {
    const shuffled = [rows[2], rows[0], rows[3], rows[1]];
    expect(planTrip(shuffled, 'drop').current?.name).toBe('Charu');
  });
});
