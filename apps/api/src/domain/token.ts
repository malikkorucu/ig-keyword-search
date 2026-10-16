const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return (date.getTime() - now.getTime()) / DAY_MS;
}
