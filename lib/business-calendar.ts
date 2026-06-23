/** Default matches server `TIMEZONE` / `Asia/Kolkata`. */
export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Kolkata';

export function ymdInTimeZone(date: Date | string, timeZone: string = DEFAULT_BUSINESS_TIMEZONE): string | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  if (!map.year || !map.month || !map.day) return null;
  return `${map.year}-${map.month}-${map.day}`;
}

/** Same rule as server: check-out strictly after check-in, wall date from check-out in `timezone`.
 *  Admin-released sessions (`adminDayRelease`) do not count toward same-day revisit limits — mirror `jobcard.service.js`. */
export function visitsShowEndedSessionToday<
  T extends { checkInAt?: string; checkOutAt?: string; adminDayRelease?: boolean }
>(
  visits: T[],
  isMine: (v: T) => boolean,
  timeZone: string
): boolean {
  const today = ymdInTimeZone(new Date(), timeZone);
  if (!today) return false;
  return visits.some((v) => {
    if (!isMine(v) || !v.checkOutAt || !v.checkInAt) return false;
    if (v.adminDayRelease) return false;
    if (new Date(v.checkOutAt).getTime() <= new Date(v.checkInAt).getTime()) return false;
    return ymdInTimeZone(v.checkOutAt, timeZone) === today;
  });
}
