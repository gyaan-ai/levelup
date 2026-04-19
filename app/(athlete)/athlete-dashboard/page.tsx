import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { COACH_REVENUE_FRACTION } from '@/lib/pricing';
import { CoachScheduleClient, type JoinRequestItem, type SlotRequestScheduleItem } from './coach-schedule-client';
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

  const cookieStore = await cookies();
  const viewAsCoachId = userData?.role === 'admin' 
    ? cookieStore.get('levelup_view_as_coach_id')?.value 
    : null;
  
  const coachId = viewAsCoachId || user.id;
  const isViewingAsCoach = !!viewAsCoachId;

  const { data: athlete } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', coachId)
    .maybeSingle();

  if (!athlete) {
    if (isViewingAsCoach) {
      return (
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Coach not found</h1>
          <p className="text-muted-foreground">Select a different coach from the dropdown above.</p>
        </div>
      );
    }
    if (userData?.role === 'admin' && !viewAsCoachId) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <h1 className="text-xl font-semibold mb-2">Schedule</h1>
          <p className="text-muted-foreground text-sm">
            Choose a coach in the header (preview as coach) to see that coach&apos;s schedule.
          </p>
        </div>
      );
    }
    redirect('/onboarding');
  }
  
  const coachStatus = athlete.status || 'active';
  if (!isViewingAsCoach && coachStatus === 'pending') {
    redirect('/coach-pending');
  }
  
  if (!isViewingAsCoach && coachStatus === 'rejected') {
    redirect('/coach-pending');
  }

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
    .limit(100);

  const { data: joinRequests } = await supabase
    .from('session_join_requests')
    .select(`
      id,
      session_id,
      message,
      status,
      created_at,
      youth_wrestler_id,
      youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const sessionIds = [...new Set((joinRequests ?? []).map((r: { session_id: string }) => r.session_id))];
  const { data: requestSessions } = sessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, scheduled_datetime, session_type, session_mode, facilities(name)')
        .in('id', sessionIds)
    : { data: [] };

  const sessionMap = new Map((requestSessions ?? []).map((s: { id: string }) => [s.id, s]));
  const requestsWithSession = (joinRequests ?? []).map((r: { session_id: string; [k: string]: unknown }) => ({
    ...r,
    session: sessionMap.get(r.session_id),
  }));

  const { data: slotRequestsRaw } = await supabase
    .from('parent_session_requests')
    .select(
      `
      id,
      requesting_parent_id,
      youth_wrestler_id,
      coach_id,
      facility_id,
      preferred_datetime,
      session_type,
      message,
      flexibility_note,
      status,
      created_at,
      youth_wrestlers:youth_wrestler_id(id, first_name, last_name, age, weight_class),
      facilities:facility_id(id, name)
    `
    )
    .eq('coach_id', coachId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const coachFirstName = athlete?.first_name ?? null;
  const coachDisplayName =
    [athlete?.first_name, athlete?.last_name].filter(Boolean).join(' ').trim() || 'Coach';
  const averageRating = athlete?.average_rating ?? null;

  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', coachId);

  return (
    <div className="container mx-auto px-4 py-5 pb-24 md:py-8 max-w-full">
      <CoachScheduleClient
        coachId={coachId}
        upcomingSessions={(upcomingSessions ?? []) as CoachSession[]}
        upcomingSessionsCount={upcomingSessionsCount ?? 0}
        pendingJoinRequests={requestsWithSession as JoinRequestItem[]}
        pendingSlotRequests={(slotRequestsRaw ?? []) as unknown as SlotRequestScheduleItem[]}
        coachFirstName={coachFirstName}
        coachDisplayName={coachDisplayName}
        coachSchool={athlete?.school ?? null}
        coachPhotoUrl={athlete?.photo_url ?? null}
        averageRating={averageRating}
        reviewCount={reviewCount ?? 0}
        payoutRate={Number(athlete?.payout_rate) || COACH_REVENUE_FRACTION}
      />
    </div>
  );
}
