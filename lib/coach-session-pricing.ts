import type { SupabaseClient } from '@supabase/supabase-js';

/** Session type keys used by coach create-session UI and admin POST */
export type CoachCreateSessionType = 'small_group' | 'partner' | 'private';

const PRODUCT_SLUG: Record<CoachCreateSessionType, string> = {
  small_group: 'small-group',
  partner: 'partner',
  private: 'private',
};

/** Fallbacks when product row is missing */
export const COACH_SESSION_FALLBACK_USD: Record<CoachCreateSessionType, number> = {
  small_group: 30,
  partner: 50,
  private: 60,
};

/** Fixed rates on every public coach profile (parent-facing). */
export const GUILD_COACH_PROFILE_RATES: readonly { label: string; amountUsd: number }[] = [
  { label: 'Small groups', amountUsd: COACH_SESSION_FALLBACK_USD.small_group },
  { label: 'Partners', amountUsd: COACH_SESSION_FALLBACK_USD.partner },
  { label: 'Private', amountUsd: COACH_SESSION_FALLBACK_USD.private },
];

/** Order and labels for public coach profile rate list (amounts come from services or product fallback). */
export const COACH_PROFILE_PUBLIC_RATE_ROWS: readonly {
  sessionType: CoachCreateSessionType;
  label: string;
  sublabel: string;
}[] = [
  { sessionType: 'small_group', label: 'Small groups', sublabel: 'per participant' },
  { sessionType: 'partner', label: 'Partners', sublabel: 'per participant' },
  { sessionType: 'private', label: 'Private', sublabel: 'one-on-one' },
];

/**
 * Parent-facing $ amounts on coach profile: prefers active athlete_services (60 min tier if present),
 * else minimum price for that type; falls back to org products / COACH_SESSION_FALLBACK.
 */
export async function getCoachDisplayedParentRates(
  admin: SupabaseClient,
  athleteId: string
): Promise<Record<CoachCreateSessionType, number>> {
  const { data: rows } = await admin
    .from('athlete_services')
    .select('session_type, parent_price, duration_minutes')
    .eq('athlete_id', athleteId)
    .eq('active', true);

  const types: CoachCreateSessionType[] = ['private', 'partner', 'small_group'];
  const fromServices: Partial<Record<CoachCreateSessionType, number>> = {};

  for (const t of types) {
    // Public profile shows the 1-hour tier only. Using Math.min across all durations
    // surfaced stale rows (e.g. legacy $45 partner on a shorter duration) over the 60m rate.
    const hourOnly = (rows ?? []).filter(
      (r) =>
        (r as { session_type: string }).session_type === t &&
        (r as { duration_minutes: number }).duration_minutes === 60
    );
    if (hourOnly.length === 0) continue;
    fromServices[t] = Math.min(
      ...hourOnly.map((r) => Number((r as { parent_price: unknown }).parent_price))
    );
  }

  const productFallback = await getRecommendedPricesForCoach(admin, athleteId);
  return {
    private: fromServices.private ?? productFallback.private,
    partner: fromServices.partner ?? productFallback.partner,
    small_group: fromServices.small_group ?? productFallback.small_group,
  };
}

/**
 * Parent price per spot (or per private session) from products + athlete_products override.
 */
export async function getRecommendedPricePerParticipant(
  admin: SupabaseClient,
  athleteId: string,
  sessionType: CoachCreateSessionType
): Promise<number> {
  const slug = PRODUCT_SLUG[sessionType];
  const { data: product } = await admin
    .from('products')
    .select('id, parent_price')
    .eq('slug', slug)
    .maybeSingle();
  if (!product) return COACH_SESSION_FALLBACK_USD[sessionType];

  const { data: ap } = await admin
    .from('athlete_products')
    .select('custom_parent_price')
    .eq('athlete_id', athleteId)
    .eq('product_id', product.id)
    .maybeSingle();
  const custom = (ap as { custom_parent_price?: number | null } | null)?.custom_parent_price;
  if (custom != null && !Number.isNaN(Number(custom))) return Number(custom);
  const base = Number(product.parent_price);
  return Number.isFinite(base) && base > 0 ? base : COACH_SESSION_FALLBACK_USD[sessionType];
}

export async function getRecommendedPricesForCoach(
  admin: SupabaseClient,
  athleteId: string
): Promise<Record<CoachCreateSessionType, number>> {
  const types: CoachCreateSessionType[] = ['small_group', 'partner', 'private'];
  const entries = await Promise.all(
    types.map(async (t) => [t, await getRecommendedPricePerParticipant(admin, athleteId, t)] as const)
  );
  return Object.fromEntries(entries) as Record<CoachCreateSessionType, number>;
}
