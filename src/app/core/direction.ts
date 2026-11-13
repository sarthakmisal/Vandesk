export type Direction = 'pickup' | 'drop';

/** Morning = pickup (home to school), afternoon = drop (school to home), in Indian time. */
export const defaultDirection = (): Direction => {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(
      new Date(),
    ),
  );
  return hour < 12 ? 'pickup' : 'drop';
};
