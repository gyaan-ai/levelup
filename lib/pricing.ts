/**
 * Standardized revenue split: coach receives 80% of gross from parents; guild/platform 20%.
 * Applied consistently across session types, estimates, and payout suggestions.
 */
export const COACH_REVENUE_FRACTION = 0.8;
export const GUILD_REVENUE_FRACTION = 1 - COACH_REVENUE_FRACTION;

/** For UI display (e.g. "Guild share: ~20%") */
export const GUILD_PERCENT_DISPLAY = 20;

/** Coach payout per participant from parent price: parentPrice * COACH_REVENUE_FRACTION, rounded to cents */
export function coachPayoutFromParentPrice(parentPrice: number): number {
  return Math.round(parentPrice * COACH_REVENUE_FRACTION * 100) / 100;
}
