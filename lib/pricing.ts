/**
 * Guild revenue share applied to custom coach rates.
 * Same effective % across session types: Private $10/$60, Partner $15/$90, Small group $30/$180 = 1/6.
 * Coach receives the remainder (5/6). Stripe fees are paid from the guild share.
 */
export const GUILD_REVENUE_FRACTION = 1 / 6;
export const COACH_REVENUE_FRACTION = 1 - GUILD_REVENUE_FRACTION;

/** For UI display (e.g. "Guild share: ~17%") */
export const GUILD_PERCENT_DISPLAY = 17;

/** Coach payout per participant from parent price: parentPrice * COACH_REVENUE_FRACTION, rounded to cents */
export function coachPayoutFromParentPrice(parentPrice: number): number {
  return Math.round(parentPrice * COACH_REVENUE_FRACTION * 100) / 100;
}
