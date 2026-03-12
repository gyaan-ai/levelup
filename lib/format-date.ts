/**
 * App-wide date/time display in Eastern Time (America/New_York).
 * Use these helpers for all user-facing dates so the system is consistently EST.
 */

import { formatInTimeZone } from 'date-fns-tz';

export const APP_TIMEZONE = 'America/New_York';

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Format a date/time in EST. Uses same format tokens as date-fns format(). */
export function formatEST(d: Date | string | number, formatStr: string): string {
  return formatInTimeZone(toDate(d), APP_TIMEZONE, formatStr);
}
