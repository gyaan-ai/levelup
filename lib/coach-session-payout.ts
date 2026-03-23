/**
 * Coach payout for a session (USD). Single source of truth for admin payouts,
 * coach schedule UI, and APIs.
 *
 * - If `athlete_payment` is set (> 0), use it (bookings, Stripe, or manual record).
 * - Otherwise estimate from roster: parent price per slot × participants × coach share (5/6).
 */
import { COACH_REVENUE_FRACTION } from '@/lib/pricing';

export type SessionCoachPayoutFields = {
  athlete_payment?: number | null;
  price_per_participant?: number | null;
  current_participants?: number | null;
};

export function coachPayoutUsd(session: SessionCoachPayoutFields): number {
  if (session.athlete_payment != null && Number(session.athlete_payment) > 0) {
    return Math.round(Number(session.athlete_payment) * 100) / 100;
  }
  const per = Number(session.price_per_participant ?? 0);
  const n = Number(session.current_participants ?? 0);
  return Math.round(per * COACH_REVENUE_FRACTION * n * 100) / 100;
}
