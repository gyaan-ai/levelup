import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { coachPayoutUsd } from '@/lib/coach-session-payout';
import { normalizeCoachRevenueShareRate } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient(tenant.slug);

  // Get all active coaches with their stats
  const { data: coaches, error: coachesError } = await admin
    .from('athletes')
    .select('id, first_name, last_name, average_rating, review_count, payout_rate')
    .eq('active', true);

  if (coachesError) {
    return NextResponse.json({ error: coachesError.message }, { status: 500 });
  }

  const coachIds = coaches?.map((c) => c.id) ?? [];

  const coachDefaultRateMap: Record<string, number> = {};
  (coaches ?? []).forEach((c) => {
    coachDefaultRateMap[c.id] = normalizeCoachRevenueShareRate(
      c.payout_rate != null ? Number(c.payout_rate) : null
    );
  });

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const thisMonthIso = thisMonthStart.toISOString();

  const { data: completedSessions } = await admin
    .from('sessions')
    .select(
      `
      athlete_id,
      completed_at,
      athlete_payment,
      price_per_participant,
      current_participants,
      session_payout_rate,
      session_participants(id, amount_paid)
    `
    )
    .in('athlete_id', coachIds)
    .eq('status', 'completed');

  const sessionCountMap: Record<string, number> = {};
  const thisMonthCountMap: Record<string, number> = {};
  const earningsMap: Record<string, number> = {};

  completedSessions?.forEach((s) => {
    const aid = s.athlete_id as string;
    sessionCountMap[aid] = (sessionCountMap[aid] || 0) + 1;

    const completedAt = s.completed_at ? String(s.completed_at) : '';
    if (completedAt && completedAt >= thisMonthIso) {
      thisMonthCountMap[aid] = (thisMonthCountMap[aid] || 0) + 1;
    }

    const participants = s.session_participants as { amount_paid?: number | null }[] | null;
    const participantAmountPaidSum = Array.isArray(participants)
      ? participants.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
      : 0;
    const rate = coachDefaultRateMap[aid] ?? normalizeCoachRevenueShareRate(null);
    const payout = coachPayoutUsd(
      {
        athlete_payment: s.athlete_payment,
        price_per_participant: s.price_per_participant,
        current_participants: s.current_participants,
        participant_amount_paid_sum: participantAmountPaidSum > 0 ? participantAmountPaidSum : null,
        session_payout_rate: s.session_payout_rate,
        coach_payout_rate: coachDefaultRateMap[aid],
      },
      rate
    );
    earningsMap[aid] = (earningsMap[aid] || 0) + payout;
  });

  // Build leaderboard with rankings
  const leaderboard = (coaches ?? []).map((coach) => ({
    id: coach.id,
    name: `${coach.first_name} ${coach.last_name}`,
    sessionCount: sessionCountMap[coach.id] || 0,
    totalEarningsUsd: Math.round((earningsMap[coach.id] || 0) * 100) / 100,
    averageRating:
      coach.average_rating != null ? Number(coach.average_rating) : null,
    reviewCount: coach.review_count || 0,
    thisMonthSessions: thisMonthCountMap[coach.id] || 0,
  }));

  // Sort by session count for ranking
  const bySessionCount = [...leaderboard].sort((a, b) => b.sessionCount - a.sessionCount);
  const sessionRankMap: Record<string, number> = {};
  bySessionCount.forEach((c, i) => {
    sessionRankMap[c.id] = i + 1;
  });

  const byEarnings = [...leaderboard].sort((a, b) => b.totalEarningsUsd - a.totalEarningsUsd);
  const earningsRankMap: Record<string, number> = {};
  byEarnings.forEach((c, i) => {
    earningsRankMap[c.id] = i + 1;
  });

  // Sort by rating for ranking (only those with reviews); tie-break by review count
  const byRating = [...leaderboard]
    .filter((c) => c.reviewCount > 0 && c.averageRating != null)
    .sort((a, b) => {
      const br = b.averageRating ?? 0;
      const ar = a.averageRating ?? 0;
      if (br !== ar) return br - ar;
      return b.reviewCount - a.reviewCount;
    });
  const ratingRankMap: Record<string, number> = {};
  byRating.forEach((c, i) => {
    ratingRankMap[c.id] = i + 1;
  });

  // Add ranks to each coach
  const rankedLeaderboard = leaderboard.map((coach) => ({
    ...coach,
    sessionRank: sessionRankMap[coach.id] || leaderboard.length,
    earningsRank: earningsRankMap[coach.id] || leaderboard.length,
    ratingRank: ratingRankMap[coach.id] || null,
    // "On Fire" = 3+ sessions this month
    isOnFire: coach.thisMonthSessions >= 3,
  }));

  return NextResponse.json({
    leaderboard: rankedLeaderboard,
    totalCoaches: leaderboard.length,
  });
}
