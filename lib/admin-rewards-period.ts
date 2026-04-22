import { addMonths, parseISO, startOfMonth, subMonths } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/format-date';

export type RewardsCardPeriod = 'this_month' | 'last_month' | 'all';

/** Eastern calendar month for summary cards (this / last). */
export function easternMonthRangeForCard(period: Exclude<RewardsCardPeriod, 'all'>): {
  startIso: string;
  endIsoExclusive: string;
} {
  const z = toZonedTime(new Date(), APP_TIMEZONE);
  const ref = period === 'this_month' ? z : subMonths(z, 1);
  const startLocal = startOfMonth(ref);
  const endExclusiveLocal = startOfMonth(addMonths(ref, 1));
  return {
    startIso: fromZonedTime(startLocal, APP_TIMEZONE).toISOString(),
    endIsoExclusive: fromZonedTime(endExclusiveLocal, APP_TIMEZONE).toISOString(),
  };
}

/** Eastern month bounds from calendar year + month (1–12), for type table picker. */
export function easternMonthBoundsFromYearMonth(year: number, month1: number): {
  startIso: string;
  endIsoExclusive: string;
} {
  const anchor = parseISO(`${year}-${String(month1).padStart(2, '0')}-15T12:00:00`);
  const z = toZonedTime(anchor, APP_TIMEZONE);
  const startLocal = startOfMonth(z);
  const endExclusiveLocal = startOfMonth(addMonths(startLocal, 1));
  return {
    startIso: fromZonedTime(startLocal, APP_TIMEZONE).toISOString(),
    endIsoExclusive: fromZonedTime(endExclusiveLocal, APP_TIMEZONE).toISOString(),
  };
}
