/**
 * Entire product uses Eastern (EST/EDT — America/New_York) only.
 * All dates and times are displayed and interpreted in Eastern. Do not show or reference other timezones.
 */

import { parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const APP_TIMEZONE = 'America/New_York';

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Format a date/time in EST. Uses same format tokens as date-fns format(). */
export function formatEST(d: Date | string | number, formatStr: string): string {
  return formatInTimeZone(toDate(d), APP_TIMEZONE, formatStr);
}

/**
 * Calendar days from `from` to `to` in Eastern (same wall clock as the rest of the app).
 * Use this for "Tomorrow" / "In N days" — not `differenceInDays` from date-fns, which counts
 * full local-day periods and can be off by one (e.g. Thu evening → Sat morning reads as 1).
 * Compares `yyyy-MM-dd` strings from `formatEST` so server vs browser timezone does not matter.
 */
export function easternCalendarDaysBetween(
  from: Date | string | number,
  to: Date | string | number
): number {
  const a = formatEST(from, 'yyyy-MM-dd');
  const b = formatEST(to, 'yyyy-MM-dd');
  const [y0, m0, d0] = a.split('-').map(Number);
  const [y1, m1, d1] = b.split('-').map(Number);
  const u0 = Date.UTC(y0, m0 - 1, d0);
  const u1 = Date.UTC(y1, m1 - 1, d1);
  return (u1 - u0) / 86400000;
}

/**
 * Day of week for a calendar `yyyy-MM-dd` in Eastern (0 = Sunday … 6 = Saturday),
 * matching `athlete_availability.day_of_week` / PostgreSQL `EXTRACT(DOW)`.
 */
export function easternSundayZeroDowFromYmd(ymd: string): number {
  const i = parseInt(formatInTimeZone(parseISO(`${ymd}T12:00:00`), APP_TIMEZONE, 'i'), 10);
  return i === 7 ? 0 : i;
}

/**
 * Calendar date + clock time chosen in Eastern → UTC ISO for `timestamptz` columns.
 * Without this, Postgres treats naive `YYYY-MM-DDTHH:mm` as UTC and My bookings shows the wrong time.
 */
export function easternWallDateTimeToUtcIso(scheduledDate: string, scheduledTime: string): string {
  const [datePart] = scheduledDate.split('T');
  const timePart = scheduledTime.includes(':') ? scheduledTime : `${scheduledTime}:00`;
  const localIso = `${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
  return fromZonedTime(localIso, APP_TIMEZONE).toISOString();
}
