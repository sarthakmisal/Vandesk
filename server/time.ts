/** Business dates and times are Indian Standard Time (Asia/Kolkata); timestamps are stored in UTC. */
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface Ist {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  period: string; // YYYY-MM
  day: number;
  hour: number;
}

export function ist(d: Date): Ist {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    date: `${p['year']}-${p['month']}-${p['day']}`,
    time: `${p['hour']}:${p['minute']}`,
    period: `${p['year']}-${p['month']}`,
    day: Number(p['day']),
    hour: Number(p['hour']),
  };
}

export const istTime = (d: Date | string | null | undefined): string | undefined =>
  d ? ist(new Date(d)).time : undefined;
export type Direction = 'pickup' | 'drop';
/** Morning = pickup, afternoon = drop. */
export const defaultDirection = (d: Date): Direction => (ist(d).hour < 12 ? 'pickup' : 'drop');
