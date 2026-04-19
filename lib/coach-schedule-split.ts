import { formatEST } from '@/lib/format-date';

/** Eastern calendar day key for `d` (Date in any TZ). */
export function easternDayKeyFromDate(d: Date): string {
  return formatEST(d, 'yyyy-MM-dd');
}

export function easternDayKeyFromIso(iso: string): string {
  return formatEST(iso, 'yyyy-MM-dd');
}

/**
 * Split coach upcoming sessions (already filtered to scheduled_datetime >= now) into
 * "today" vs later dates, using America/New_York calendar days.
 */
export function splitCoachSessionsByToday<T extends { scheduled_datetime: string }>(
  sessions: T[],
  now: Date
): { today: T[]; upcoming: T[] } {
  const todayKey = easternDayKeyFromDate(now);
  const today: T[] = [];
  const upcoming: T[] = [];
  for (const s of sessions) {
    const k = easternDayKeyFromIso(s.scheduled_datetime);
    if (k === todayKey) today.push(s);
    else if (k > todayKey) upcoming.push(s);
  }
  const byTime = (a: T, b: T) =>
    new Date(a.scheduled_datetime).getTime() - new Date(b.scheduled_datetime).getTime();
  today.sort(byTime);
  upcoming.sort(byTime);
  return { today, upcoming };
}
