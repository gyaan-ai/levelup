/**
 * Coach payout for a session (USD). Single source of truth for admin payouts,
 * coach schedule UI, and APIs.
 *
 * - If `athlete_payment` is set (> 0), use it (bookings, Stripe, or manual record).
 * - Else if we know what parents actually paid (sum of `session_participants.amount_paid`),
 *   coach share = that total × 5/6 (captures family % discounts, comps, etc.).
 * - Otherwise estimate from roster: list price per slot × participants × coach share (5/6).
 */
import { COACH_REVENUE_FRACTION } from '@/lib/pricing';

export type SessionCoachPayoutFields = {
  athlete_payment?: number | null;
  price_per_participant?: number | null;
  current_participants?: number | null;
  /** Sum of session_participants.amount_paid when loaded — reflects discounts vs list price */
  participant_amount_paid_sum?: number | null;
};

export function coachPayoutUsd(session: SessionCoachPayoutFields): number {
  if (session.athlete_payment != null && Number(session.athlete_payment) > 0) {
    return Math.round(Number(session.athlete_payment) * 100) / 100;
  }
  const paidSum =
    session.participant_amount_paid_sum != null ? Number(session.participant_amount_paid_sum) : 0;
  if (!Number.isNaN(paidSum) && paidSum > 0) {
    return Math.round(paidSum * COACH_REVENUE_FRACTION * 100) / 100;
  }
  const per = Number(session.price_per_participant ?? 0);
  const n = Number(session.current_participants ?? 0);
  return Math.round(per * COACH_REVENUE_FRACTION * n * 100) / 100;
}
