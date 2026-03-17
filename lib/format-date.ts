/**
 * Entire product uses Eastern (EST/EDT — America/New_York) only.
 * All dates and times are displayed and interpreted in Eastern. Do not show or reference other timezones.
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
