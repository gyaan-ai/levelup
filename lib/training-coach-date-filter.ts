import { easternSundayZeroDowFromYmd } from '@/lib/format-date';

export type CoachDateFilterData = {
  /** Eastern yyyy-MM-dd → coach ids with at least one bookable public session that calendar day. */
  openPublicCoachIdsByDate: Record<string, string[]>;
  /** Coach id → day_of_week values (0 Sun … 6 Sat) with recurring availability. */
  weeklyDowByCoach: Record<string, number[]>;
  /** Coach id → dated slot dates (yyyy-MM-dd) within the loaded horizon. */
  slotDatesByCoach: Record<string, string[]>;
  /** Coach id → blocked dates (yyyy-MM-dd). */
  blockedDatesByCoach: Record<string, string[]>;
};

export type CoachSessionTypeFilter =
  | 'all'
  | 'small_group'
  | 'partner_private'
  | 'private'
  | 'partner';

/**
 * When `dateYmd` is set, returns coach ids allowed by the Coaches-tab date rule:
 * - All or Small group: public open sessions that day
 * - Partner, Private, or Partner / Private: weekly or dated availability that day, not blocked
 * - All: union of both
 *
 * Does not apply service-type offerings (caller intersects with `serviceTypesByCoach`).
 * "Fully booked for the day" is not modeled here (would need per-slot booking reconciliation).
 */
export function coachIdsMatchingDateFilter(
  dateYmd: string | null | undefined,
  sessionType: CoachSessionTypeFilter,
  data: CoachDateFilterData,
  allCoachIds: string[]
): Set<string> | null {
  if (!dateYmd) return null;

  const fromPublic = new Set(data.openPublicCoachIdsByDate[dateYmd] ?? []);
  const dow = easternSundayZeroDowFromYmd(dateYmd);
  const blockedFor = (coachId: string) => new Set(data.blockedDatesByCoach[coachId] ?? []).has(dateYmd);

  const fromAvail = new Set<string>();
  for (const id of allCoachIds) {
    if (blockedFor(id)) continue;
    const weekly = data.weeklyDowByCoach[id] ?? [];
    const slots = data.slotDatesByCoach[id] ?? [];
    if (weekly.includes(dow) || slots.includes(dateYmd)) fromAvail.add(id);
  }

  if (sessionType === 'all') return new Set([...fromPublic, ...fromAvail]);
  if (sessionType === 'small_group') return fromPublic;
  return fromAvail;
}
