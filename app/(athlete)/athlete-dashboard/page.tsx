import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { isProfileComplete } from '@/lib/athletes';
import { coachPayoutUsd } from '@/lib/coach-session-payout';
import { CoachHomeClient } from './coach-home-client';
import type { CoachSession } from './coach-schedule-card';

export const dynamic = 'force-dynamic';

export default async function CoachHomePage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'coach' && userData?.role !== 'admin') {
    if (userData?.role === 'parent') redirect('/browse');
    redirect('/login');
  }

  // For admins viewing as a specific coach, use the viewAsCoachId
  const cookieStore = await cookies();
  const viewAsCoachId = userData?.role === 'admin' 
    ? cookieStore.get('levelup_view_as_coach_id')?.value 
    : null;
  
  // The coach ID to use for queries - either the viewed coach or the logged-in user
  const coachId = viewAsCoachId || user.id;
  const isViewingAsCoach = !!viewAsCoachId;

  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', coachId)
    .maybeSingle();

  // For admins viewing as coach, don't redirect to onboarding - show the coach's dashboard
  if (!athlete) {
    if (isViewingAsCoach) {
      // Coach not found - maybe invalid ID in cookie
      return (
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Coach not found</h1>
          <p className="text-muted-foreground">Select a different coach from the dropdown above.</p>
        </div>
      );
    }
    redirect('/onboarding');
  }
  
  // Check if coach is pending approval (only for actual coaches, not admin viewing)
  // Treat undefined/null status as 'active' for backwards compatibility with existing coaches
  const coachStatus = athlete.status || 'active';
  if (!isViewingAsCoach && coachStatus === 'pending') {
    redirect('/coach-pending');
  }
  
  // Check if coach was rejected
  if (!isViewingAsCoach && coachStatus === 'rejected') {
    redirect('/coach-pending');
  }
  
  const needsOnboarding = !isViewingAsCoach && !isProfileComplete(athlete);

  // This month earnings — same rules as coach-earnings / coachPayoutUsd (not raw athlete_payment alone).
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const payoutRateHome = Number(athlete?.payout_rate) || 0.8333;

  const { data: completedForMonth } = await supabase
    .from('sessions')
    .select(
      'athlete_payment, price_per_participant, current_participants, completed_at, scheduled_datetime, session_participants(amount_paid)'
    )
    .eq('athlete_id', coachId)
    .eq('status', 'completed');

  function sessionFallsInThisMonth(completedAt: string | null, scheduledAt: string | null): boolean {
    const raw = completedAt || scheduledAt;
    if (!raw) return false;
    const d = new Date(raw);
    return d.getFullYear() === thisMonthStart.getFullYear() && d.getMonth() === thisMonthStart.getMonth();
  }

  const thisMonthEarnings =
    (completedForMonth ?? []).reduce((sum, s) => {
      if (!sessionFallsInThisMonth(s.completed_at as string | null, s.scheduled_datetime as string | null)) {
        return sum;
      }
      const parts = s.session_participants;
      const participantAmountPaidSum = Array.isArray(parts)
        ? parts.reduce((acc, p) => acc + Number((p as { amount_paid?: number | null }).amount_paid || 0), 0)
        : 0;
      return (
        sum +
        coachPayoutUsd(
          {
            athlete_payment: s.athlete_payment as number | null | undefined,
            price_per_participant: s.price_per_participant as number | null | undefined,
            current_participants: s.current_participants as number | null | undefined,
            participant_amount_paid_sum: participantAmountPaidSum > 0 ? participantAmountPaidSum : null,
          },
          payoutRateHome
        )
      );
    }, 0) || 0;

  // Upcoming (limit 5 for home)
  const nowIso = new Date().toISOString();

  const { count: upcomingSessionsCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', coachId)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', nowIso);

  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('*, facilities(id, name), session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))')
    .eq('athlete_id', coachId)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', nowIso)
    .order('scheduled_datetime', { ascending: true })
    .limit(5);

  // Pending join requests for this coach's sessions (RLS allows coach to read their session requests after migration)
  const { count: pendingRequestsCount } = await supabase
    .from('session_join_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const coachFirstName = athlete?.first_name ?? null;
  const coachDisplayName =
    [athlete?.first_name, athlete?.last_name].filter(Boolean).join(' ').trim() || 'Coach';
  const averageRating = athlete?.average_rating ?? null;

  // Get actual review count from database (not the cached column)
  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', coachId);

  // Latest reviews (limit 3 for home)
  const { data: recentReviewsRaw } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, users(first_name)')
    .eq('athlete_id', coachId)
    .order('created_at', { ascending: false })
    .limit(3);

  // Transform reviews to flatten the users join (Supabase returns it as array)
  const recentReviews = (recentReviewsRaw ?? []).map((r) => ({
    id: r.id as string,
    rating: r.rating as number,
    comment: r.comment as string | null,
    created_at: r.created_at as string,
    users: Array.isArray(r.users) ? r.users[0] ?? null : r.users,
  }));

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <CoachHomeClient
        coachId={coachId}
        upcomingSessions={(upcomingSessions ?? []) as CoachSession[]}
        upcomingSessionsCount={upcomingSessionsCount ?? 0}
        pendingRequestsCount={pendingRequestsCount ?? 0}
        thisMonthEarnings={thisMonthEarnings}
        coachFirstName={coachFirstName}
        coachDisplayName={coachDisplayName}
        coachSchool={athlete?.school ?? null}
        coachPhotoUrl={athlete?.photo_url ?? null}
        averageRating={averageRating}
        reviewCount={reviewCount ?? 0}
        recentReviews={recentReviews}
        payoutRate={Number(athlete?.payout_rate) || 0.8333}
        needsOnboarding={needsOnboarding}
      />
    </div>
  );
}
