/**
 * Merge `athlete_services.session_type` with org `products.slug` via `athlete_products`,
 * so coaches without service rows still appear in Training grid session-type filters.
 * Slug → athlete_services session_type: private, partner, small-group → small_group.
 */
export const DEFAULT_OFFERED_SESSION_TYPES = ['private', 'partner', 'small_group'] as const;

export function productSlugToServiceType(slug: string): 'private' | 'partner' | 'small_group' | null {
  const s = slug.trim().toLowerCase();
  if (s === 'private') return 'private';
  if (s === 'partner') return 'partner';
  if (s === 'small-group' || s === 'small_group' || s === 'group') return 'small_group';
  return null;
}

export function buildServiceTypesByCoach(params: {
  athleteIds: string[];
  serviceRows: { athlete_id: string; session_type: string }[];
  productRows: { athlete_id: string; slug: string }[];
}): Record<string, string[]> {
  const { athleteIds, serviceRows, productRows } = params;
  const byCoach = new Map<string, Set<string>>();
  for (const id of athleteIds) {
    byCoach.set(id, new Set());
  }
  for (const r of serviceRows) {
    const set = byCoach.get(r.athlete_id);
    if (set) set.add(r.session_type);
  }
  for (const r of productRows) {
    const mapped = productSlugToServiceType(r.slug);
    if (!mapped) continue;
    const set = byCoach.get(r.athlete_id);
    if (set) set.add(mapped);
  }

  const out: Record<string, string[]> = {};
  for (const id of athleteIds) {
    const arr = [...(byCoach.get(id) ?? [])];
    // Active coach with no explicit offerings: treat as full Guild menu so they stay discoverable.
    out[id] = arr.length > 0 ? arr : [...DEFAULT_OFFERED_SESSION_TYPES];
  }
  return out;
}
