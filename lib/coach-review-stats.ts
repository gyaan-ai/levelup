import type { SupabaseClient } from '@supabase/supabase-js';

/** Aggregated from `reviews` / `reviews_anonymous` — not denormalized `athletes` columns. */
export type CoachReviewStats = { average_rating: number; review_count: number };

/**
 * Batch-load average + count from reviews_anonymous for many coaches (one query).
 * Use everywhere we show StarRating so UI matches DB even if athletes.average_rating is stale.
 */
export async function fetchCoachReviewStatsMap(
  supabase: SupabaseClient,
  athleteIds: string[]
): Promise<Map<string, CoachReviewStats>> {
  const map = new Map<string, CoachReviewStats>();
  const unique = [...new Set(athleteIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: rows, error } = await supabase
    .from('reviews_anonymous')
    .select('athlete_id, rating')
    .in('athlete_id', unique);

  if (error) {
    console.error('[fetchCoachReviewStatsMap]', error);
    return map;
  }

  const sums = new Map<string, { sum: number; count: number }>();
  for (const row of rows ?? []) {
    const aid = row.athlete_id as string;
    const rating = Number((row as { rating: number }).rating);
    if (!Number.isFinite(rating)) continue;
    const cur = sums.get(aid) ?? { sum: 0, count: 0 };
    cur.sum += rating;
    cur.count += 1;
    sums.set(aid, cur);
  }

  for (const [aid, { sum, count }] of sums) {
    map.set(aid, {
      average_rating: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      review_count: count,
    });
  }

  return map;
}

export function getCoachReviewStatsForId(
  map: Map<string, CoachReviewStats>,
  athleteId: string
): CoachReviewStats {
  return map.get(athleteId) ?? { average_rating: 0, review_count: 0 };
}

export function mergeCoachReviewStatsIntoAthlete<
  T extends { id: string; average_rating?: number | null; review_count?: number | null },
>(athlete: T, map: Map<string, CoachReviewStats>): T {
  const s = getCoachReviewStatsForId(map, athlete.id);
  return {
    ...athlete,
    average_rating: s.average_rating,
    review_count: s.review_count,
  };
}

/** Sort browse/training coach lists: higher rating first, then school name. */
export function sortAthletesForBrowse<
  T extends { average_rating?: number | null; school?: string; first_name?: string },
>(athletes: T[]): T[] {
  return [...athletes].sort((a, b) => {
    const ra = Number(a.average_rating) || 0;
    const rb = Number(b.average_rating) || 0;
    if (rb !== ra) return rb - ra;
    return (a.school || '').localeCompare(b.school || '');
  });
}

/** Patch embedded `athletes` on a session row (object or single-element array). */
export function patchSessionAthletesReviewStats<T extends { athletes?: unknown }>(
  session: T,
  map: Map<string, CoachReviewStats>
): T {
  const a = session.athletes;
  if (!a) return session;
  const coach = Array.isArray(a) ? a[0] : a;
  if (!coach || typeof coach !== 'object' || !('id' in coach)) return session;
  const merged = mergeCoachReviewStatsIntoAthlete(coach as { id: string }, map);
  return { ...session, athletes: Array.isArray(a) ? [merged] : merged } as T;
}

export function patchSessionsWithCoachReviewStats<T extends { athletes?: unknown }>(
  sessions: T[],
  map: Map<string, CoachReviewStats>
): T[] {
  return sessions.map((s) => patchSessionAthletesReviewStats(s, map));
}
