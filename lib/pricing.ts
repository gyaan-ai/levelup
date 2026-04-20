/**
 * Standardized revenue split: coach receives 80% of gross from parents; guild/platform 20%.
 * Applied consistently across session types, estimates, and payout suggestions.
 */
export const COACH_REVENUE_FRACTION = 0.8;
export const GUILD_REVENUE_FRACTION = 1 - COACH_REVENUE_FRACTION;

/** Legacy DB values near 5/6 (~83.33%) from an older split; treat as standard 80%. */
const LEGACY_COACH_SHARE_BAND_MIN = 0.831;
const LEGACY_COACH_SHARE_BAND_MAX = 0.835;

/**
 * Normalize stored coach share for display and payout math. Maps legacy ~83.33% to 80%.
 * Does not change intentional overrides (e.g. founding coaches at 90%).
 */
export function normalizeCoachRevenueShareRate(rate: number | null | undefined): number {
  const r =
    rate != null && !Number.isNaN(Number(rate)) ? Number(rate) : COACH_REVENUE_FRACTION;
  if (r >= LEGACY_COACH_SHARE_BAND_MIN && r <= LEGACY_COACH_SHARE_BAND_MAX) {
    return COACH_REVENUE_FRACTION;
  }
  return r;
}

/** Whole percent for UI labels (e.g. 80). */
export function coachRevenueSharePercentDisplay(rate: number | null | undefined): number {
  return Math.round(normalizeCoachRevenueShareRate(rate) * 100);
}

/** For UI display (e.g. "Guild share: ~20%") */
export const GUILD_PERCENT_DISPLAY = 20;

/** Coach payout per participant from parent price: parentPrice * COACH_REVENUE_FRACTION, rounded to cents */
export function coachPayoutFromParentPrice(parentPrice: number): number {
  return Math.round(parentPrice * COACH_REVENUE_FRACTION * 100) / 100;
}
