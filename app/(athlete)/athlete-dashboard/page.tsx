import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { isProfileComplete } from '@/lib/athletes';
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
  if (!isViewingAsCoach && !isProfileComplete(athlete)) redirect('/onboarding');

  // This month earnings (one number for quick actions)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const { data: thisMonthSessions } = await supabase
    .from('sessions')
    .select('athlete_payment')
    .eq('athlete_id', coachId)
    .eq('status', 'completed')
    .gte('completed_at', thisMonthStart.toISOString());
  const thisMonthEarnings = thisMonthSessions?.reduce((sum, s) => sum + Number(s.athlete_payment || 0), 0) || 0;

  // Upcoming (limit 5 for home)
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('*, facilities(name), session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))')
    .eq('athlete_id', coachId)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', new Date().toISOString())
    .order('scheduled_datetime', { ascending: true })
    .limit(5);

  // Pending join requests for this coach's sessions (RLS allows coach to read their session requests after migration)
  const { count: pendingRequestsCount } = await supabase
    .from('session_join_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const coachFirstName = athlete?.first_name ?? null;
  const averageRating = athlete?.average_rating ?? null;
  const reviewCount = athlete?.review_count ?? 0;

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
        upcomingSessions={(upcomingSessions ?? []) as CoachSession[]}
        pendingRequestsCount={pendingRequestsCount ?? 0}
        thisMonthEarnings={thisMonthEarnings}
        coachFirstName={coachFirstName}
        averageRating={averageRating}
        reviewCount={reviewCount}
        recentReviews={recentReviews}
      />
    </div>
  );
}
