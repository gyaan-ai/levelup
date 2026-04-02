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
  private: 75,
};

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
