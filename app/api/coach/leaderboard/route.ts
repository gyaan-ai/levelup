import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

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
    .select('id, first_name, last_name, average_rating, review_count')
    .eq('active', true);

  if (coachesError) {
    return NextResponse.json({ error: coachesError.message }, { status: 500 });
  }

  // Get session counts for each coach (completed sessions)
  const coachIds = coaches?.map(c => c.id) ?? [];
  
  // Get completed session counts
  const { data: sessionCounts } = await admin
    .from('sessions')
    .select('athlete_id')
    .in('athlete_id', coachIds)
    .eq('status', 'completed');

  // Count sessions per coach
  const sessionCountMap: Record<string, number> = {};
  sessionCounts?.forEach(s => {
    sessionCountMap[s.athlete_id] = (sessionCountMap[s.athlete_id] || 0) + 1;
  });

  // Get this month's completed sessions for "On Fire" badge
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  
  const { data: thisMonthSessions } = await admin
    .from('sessions')
    .select('athlete_id')
    .in('athlete_id', coachIds)
    .eq('status', 'completed')
    .gte('completed_at', thisMonthStart.toISOString());

  const thisMonthCountMap: Record<string, number> = {};
  thisMonthSessions?.forEach(s => {
    thisMonthCountMap[s.athlete_id] = (thisMonthCountMap[s.athlete_id] || 0) + 1;
  });

  // Build leaderboard with rankings
  const leaderboard = (coaches ?? []).map(coach => ({
    id: coach.id,
    name: `${coach.first_name} ${coach.last_name}`,
    sessionCount: sessionCountMap[coach.id] || 0,
    averageRating: coach.average_rating,
    reviewCount: coach.review_count || 0,
    thisMonthSessions: thisMonthCountMap[coach.id] || 0,
  }));

  // Sort by session count for ranking
  const bySessionCount = [...leaderboard].sort((a, b) => b.sessionCount - a.sessionCount);
  const sessionRankMap: Record<string, number> = {};
  bySessionCount.forEach((c, i) => {
    sessionRankMap[c.id] = i + 1;
  });

  // Sort by rating for ranking (only those with reviews)
  const byRating = [...leaderboard]
    .filter(c => c.reviewCount > 0 && c.averageRating)
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  const ratingRankMap: Record<string, number> = {};
  byRating.forEach((c, i) => {
    ratingRankMap[c.id] = i + 1;
  });

  // Add ranks to each coach
  const rankedLeaderboard = leaderboard.map(coach => ({
    ...coach,
    sessionRank: sessionRankMap[coach.id] || leaderboard.length,
    ratingRank: ratingRankMap[coach.id] || null,
    // "On Fire" = 3+ sessions this month
    isOnFire: coach.thisMonthSessions >= 3,
  }));

  return NextResponse.json({
    leaderboard: rankedLeaderboard,
    totalCoaches: leaderboard.length,
  });
}
