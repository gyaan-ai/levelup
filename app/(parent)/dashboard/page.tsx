import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import Link from 'next/link';
import { VIEW_AS_COOKIE_NAME } from '@/lib/auth/view-as-cookie';
import { getParentYouthWrestlerIds } from '@/lib/parent-wrestlers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronRight, Star, User, Plus } from 'lucide-react';
import { YouthWrestler } from '@/types';
import { ProfileImage } from '@/components/profile-image';
import { formatEST } from '@/lib/format-date';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { SchoolLogo } from '@/components/school-logo';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'coach') redirect('/athlete-dashboard');

  const isAdmin = userData?.role === 'admin';
  const cookieStore = await cookies();
  const viewAsCookie = cookieStore.get(VIEW_AS_COOKIE_NAME)?.value;
  const adminPreviewAsParent = isAdmin && viewAsCookie === 'parent';

  // If admin not previewing as parent, redirect to admin dashboard
  if (isAdmin && !adminPreviewAsParent) {
    redirect('/admin');
  }

  const nowISO = new Date().toISOString();
  const admin = createAdminClient(tenant.slug);

  // Get parent's wrestlers
  const youthWrestlerIds = await getParentYouthWrestlerIds(supabase, user.id);
  const { data: youthWrestlersRaw } = youthWrestlerIds.length > 0
    ? await supabase.from('youth_wrestlers').select('*').in('id', youthWrestlerIds).order('created_at', { ascending: false })
    : { data: [] };
  const youthWrestlers = [...new Map((youthWrestlersRaw ?? []).map((yw: YouthWrestler) => [yw.id, yw])).values()];

  // Get family session IDs
  let familySessionIds: string[] = [];
  if (youthWrestlerIds.length > 0) {
    const { data: partRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('youth_wrestler_id', youthWrestlerIds);
    familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
  }

  // Fetch upcoming sessions
  const { data: upcomingSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id,
          athlete_id,
          scheduled_datetime,
          status,
          price_per_participant,
          session_type,
          session_mode,
          focus_area,
          current_participants,
          max_participants,
          athletes(id, first_name, last_name, school, photo_url),
          facilities(id, name),
          session_participants(youth_wrestler_id, youth_wrestlers(first_name, last_name))
        `)
        .in('id', familySessionIds)
        .in('status', ['scheduled', 'pending_payment'])
        .gte('scheduled_datetime', nowISO)
        .order('scheduled_datetime', { ascending: true })
        .limit(5)
    : { data: [] };

  // Fetch sessions awaiting review (completed, no review yet)
  const { data: completedSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id,
          athlete_id,
          scheduled_datetime,
          session_type,
          session_mode,
          athletes(id, first_name, last_name, school, photo_url),
          session_participants(youth_wrestler_id, youth_wrestlers(first_name, last_name))
        `)
        .in('id', familySessionIds)
        .eq('status', 'completed')
        .order('scheduled_datetime', { ascending: false })
        .limit(20)
    : { data: [] };

  // Get existing reviews to filter out already-reviewed sessions
  const completedIds = (completedSessions ?? []).map((s: { id: string }) => s.id);
  const { data: existingReviews } = completedIds.length > 0
    ? await supabase
        .from('session_reviews')
        .select('session_id')
        .in('session_id', completedIds)
        .eq('parent_id', user.id)
    : { data: [] };
  const reviewedSessionIds = new Set((existingReviews ?? []).map((r: { session_id: string }) => r.session_id));
  const sessionsAwaitingReview = (completedSessions ?? []).filter((s: { id: string }) => !reviewedSessionIds.has(s.id)).slice(0, 3);

  // Get next session info per wrestler
  const nextSessionByWrestler: Record<string, string> = {};
  for (const s of upcomingSessions ?? []) {
    const parts = ((s as { session_participants?: Array<{ youth_wrestler_id?: string }> }).session_participants ?? []);
    for (const p of parts) {
      const yid = p.youth_wrestler_id;
      if (yid && !nextSessionByWrestler[yid]) {
        nextSessionByWrestler[yid] = (s as { scheduled_datetime: string }).scheduled_datetime;
      }
    }
  }

  type SessionRow = {
    id: string;
    scheduled_datetime: string;
    session_type?: string;
    session_mode?: string;
    focus_area?: string | null;
    current_participants?: number;
    max_participants?: number;
    price_per_participant?: number | null;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string }[] | null;
    facilities?: { id: string; name?: string } | { id: string; name?: string }[] | null;
    session_participants?: Array<{ youth_wrestler_id?: string; youth_wrestlers?: { first_name?: string; last_name?: string } | null }>;
  };

  const SessionCard = ({ session, showReviewButton = false }: { session: SessionRow; showReviewButton?: boolean }) => {
    const coach = Array.isArray(session.athletes) ? session.athletes[0] : session.athletes;
    const facility = Array.isArray(session.facilities) ? session.facilities[0] : session.facilities;
    const dt = new Date(session.scheduled_datetime);
    const price = session.price_per_participant;

    return (
      <Link href={showReviewButton ? `/sessions/${session.id}/review` : `/sessions/${session.id}`}>
        <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-all active:scale-[0.98]">
          <ProfileImage
            src={coach?.photo_url}
            alt={coach ? `${coach.first_name} ${coach.last_name}` : 'Coach'}
            className="w-14 h-14 rounded-full shrink-0"
            fallbackIconClassName="h-6 w-6 text-muted-foreground"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SessionTypeBadge sessionType={session.session_type ?? null} sessionMode={session.session_mode ?? null} size="sm" />
              {session.focus_area && (
                <span className="text-xs text-zinc-500 truncate">{session.focus_area}</span>
              )}
            </div>
            <p className="font-semibold text-foreground truncate">
              {formatEST(dt, 'EEE, MMM d')} · {formatEST(dt, 'h:mm a')}
            </p>
            <p className="text-sm text-zinc-400 truncate">
              {coach ? `${coach.first_name} ${coach.last_name}` : 'Coach'}
              {coach?.school && <SchoolLogo school={coach.school} size="sm" className="ml-1 inline-block" />}
            </p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            {showReviewButton ? (
              <div className="flex items-center gap-1 text-[#D4AF37]">
                <Star className="h-4 w-4" />
                <span className="text-sm font-medium">Review</span>
              </div>
            ) : (
              <>
                {price != null && price > 0 && (
                  <span className="text-sm font-semibold text-foreground">${price}</span>
                )}
                <ChevronRight className="h-5 w-5 text-zinc-500" />
              </>
            )}
          </div>
        </div>
      </Link>
    );
  };

  const WrestlerCard = ({ wrestler }: { wrestler: YouthWrestler }) => {
    const nextSession = nextSessionByWrestler[wrestler.id];
    
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
        <ProfileImage
          src={wrestler.photo_url}
          alt={`${wrestler.first_name} ${wrestler.last_name}`}
          focusX={wrestler.photo_focus_x ?? 50}
          focusY={wrestler.photo_focus_y ?? 15}
          className="w-16 h-16 rounded-full shrink-0"
          fallbackIconClassName="h-8 w-8 text-muted-foreground"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-lg truncate">
            {wrestler.first_name} {wrestler.last_name}
          </p>
          <p className="text-sm text-zinc-400">
            {wrestler.age != null && <span>{wrestler.age} yrs</span>}
            {wrestler.weight_class && <span> · {wrestler.weight_class} lbs</span>}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Next: {nextSession ? formatEST(new Date(nextSession), 'MMM d, h:mm a') : 'No upcoming'}
          </p>
        </div>
        <Link href={`/training?wrestler=${wrestler.id}`}>
          <Button size="sm" className="bg-[#D4AF37] hover:bg-[#B8963C] text-black font-medium">
            Book
          </Button>
        </Link>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Home</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Your training at a glance</p>
      </div>

      {/* Upcoming Sessions */}
      <section className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Upcoming Sessions</h2>
          {(upcomingSessions ?? []).length > 0 && (
            <Link href="/bookings" className="text-sm text-[#D4AF37] font-medium">
              View all
            </Link>
          )}
        </div>
        {(upcomingSessions ?? []).length > 0 ? (
          <div className="space-y-3">
            {(upcomingSessions ?? []).slice(0, 3).map((session) => (
              <SessionCard key={(session as SessionRow).id} session={session as SessionRow} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-zinc-800 bg-transparent">
            <CardContent className="py-8 text-center">
              <Calendar className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400 mb-4">No upcoming sessions</p>
              <Link href="/training">
                <Button className="bg-[#D4AF37] hover:bg-[#B8963C] text-black font-medium">
                  Find Training
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Sessions Awaiting Review */}
      {sessionsAwaitingReview.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Leave Feedback</h2>
            <span className="text-xs bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-1 rounded-full font-medium">
              {sessionsAwaitingReview.length} pending
            </span>
          </div>
          <div className="space-y-3">
            {sessionsAwaitingReview.map((session) => (
              <SessionCard key={(session as SessionRow).id} session={session as SessionRow} showReviewButton />
            ))}
          </div>
        </section>
      )}

      {/* Your Wrestlers */}
      <section className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Your Wrestlers</h2>
          <Link href="/wrestlers/add" className="text-sm text-[#D4AF37] font-medium flex items-center gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Link>
        </div>
        {youthWrestlers.length > 0 ? (
          <div className="space-y-3">
            {youthWrestlers.map((wrestler) => (
              <WrestlerCard key={wrestler.id} wrestler={wrestler} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-zinc-800 bg-transparent">
            <CardContent className="py-8 text-center">
              <User className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400 mb-1">No wrestlers yet</p>
              <p className="text-zinc-500 text-sm mb-4">Add a wrestler to start booking training</p>
              <Link href="/wrestlers/add">
                <Button className="bg-[#D4AF37] hover:bg-[#B8963C] text-black font-medium">
                  Add Wrestler
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Quick Action */}
      <section className="px-4">
        <Link href="/training">
          <Button className="w-full h-14 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-foreground font-medium text-base">
            <Calendar className="h-5 w-5 mr-2" />
            Browse All Sessions
          </Button>
        </Link>
      </section>
    </div>
  );
}
