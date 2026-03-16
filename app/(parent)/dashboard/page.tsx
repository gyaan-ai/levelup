import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getParentYouthWrestlerIds } from '@/lib/parent-wrestlers';

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Edit, User, Calendar } from 'lucide-react';
import { YouthWrestler } from '@/types';
import { BookingCard, type BookingSession } from '@/app/(parent)/bookings/booking-card';
import { CoachSessionBadge } from '@/components/coach-session-badge';
import { ProfileImage } from '@/components/profile-image';
import { formatEST } from '@/lib/format-date';

/** Parent sees only their own wrestlers (primary or linked). RLS on youth_wrestlers enforces this. */
export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'athlete') redirect('/athlete-dashboard');

  const isAdmin = userData?.role === 'admin';
  const nowISO = new Date().toISOString();

  // Admin: fetch ALL scheduled/pending sessions (no date filter) so admin always sees every session
  type AdminUpcomingRow = {
    id: string;
    scheduled_datetime: string;
    status: string;
    total_price?: number;
    parent_id?: string;
    session_type?: string;
    session_mode?: string;
    focus_area?: string | null;
    partner_invite_code?: string | null;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string }[] | null;
    facilities?: { id?: string; name?: string; address?: string } | { id?: string; name?: string; address?: string }[] | null;
    session_participants?: Array<{ youth_wrestler_id?: string; youth_wrestlers?: { first_name?: string; last_name?: string } | null }>;
  };
  let allUpcomingForAdmin: AdminUpcomingRow[] = [];
  if (isAdmin) {
    const admin = createAdminClient(tenant.slug);
    const { data: adminSessions } = await admin
      .from('sessions')
      .select(`
        id,
        scheduled_datetime,
        status,
        total_price,
        parent_id,
        session_type,
        session_mode,
        focus_area,
        partner_invite_code,
        athletes(id, first_name, last_name, school, photo_url),
        facilities(id, name, address),
        session_participants(youth_wrestler_id, youth_wrestlers(first_name, last_name))
      `)
      .in('status', ['scheduled', 'pending_payment'])
      .order('scheduled_datetime', { ascending: true })
      .limit(100);
    allUpcomingForAdmin = (adminSessions ?? []) as unknown as AdminUpcomingRow[];
  }

  // Parent sees only their wrestlers (primary or linked). Explicit filter so parents never see other users' kids.
  const youthWrestlerIds = await getParentYouthWrestlerIds(supabase, user.id);
  const { data: youthWrestlersRaw } = youthWrestlerIds.length > 0
    ? await supabase.from('youth_wrestlers').select('*').in('id', youthWrestlerIds).order('created_at', { ascending: false })
    : { data: [] };
  const youthWrestlers = [...new Map((youthWrestlersRaw ?? []).map((yw: YouthWrestler) => [yw.id, yw])).values()];

  let familySessionIds: string[] = [];
  if (youthWrestlerIds.length > 0) {
    const { data: partRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('youth_wrestler_id', youthWrestlerIds);
    familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
  }

  const { data: completedSessions } = familySessionIds.length > 0
    ? await supabase.from('sessions').select('id').in('id', familySessionIds).eq('status', 'completed')
    : { data: [] };
  const completedIds = (completedSessions ?? []).map((s: { id: string }) => s.id);

  const sessionCounts: Record<string, number> = {};
  let lastSessionByWrestler: Record<string, string> = {};
  if (youthWrestlerIds.length > 0 && completedIds.length > 0) {
    const { data: participantRows } = await supabase
      .from('session_participants')
      .select('session_id, youth_wrestler_id')
      .in('session_id', completedIds)
      .in('youth_wrestler_id', youthWrestlerIds);
    for (const p of participantRows ?? []) {
      const yid = (p as { youth_wrestler_id: string }).youth_wrestler_id;
      sessionCounts[yid] = (sessionCounts[yid] || 0) + 1;
    }
    const { data: pastSessions } = await supabase
      .from('sessions')
      .select('id, scheduled_datetime, session_participants(youth_wrestler_id)')
      .in('id', completedIds)
      .order('scheduled_datetime', { ascending: false });
    for (const sess of pastSessions ?? []) {
      const parts = (sess as { session_participants?: Array<{ youth_wrestler_id?: string }> }).session_participants ?? [];
      const dt = (sess as { scheduled_datetime?: string }).scheduled_datetime;
      if (!dt) continue;
      for (const part of parts) {
        const yid = part.youth_wrestler_id;
        if (yid && youthWrestlerIds.includes(yid) && !lastSessionByWrestler[yid]) {
          lastSessionByWrestler[yid] = dt;
        }
      }
    }
  }

  const { data: upcomingSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id,
          scheduled_datetime,
          status,
          total_price,
          parent_id,
          session_type,
          session_mode,
          focus_area,
          current_participants,
          max_participants,
          partner_invite_code,
          athletes(id, first_name, last_name, school, photo_url),
          facilities(id, name, address),
          session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))
        `)
        .in('id', familySessionIds)
        .in('status', ['scheduled', 'pending_payment'])
        .gte('scheduled_datetime', nowISO)
        .order('scheduled_datetime', { ascending: true })
        .limit(10)
    : { data: [] };

  const upcoming = (upcomingSessions ?? []) as Array<{
    id: string;
    scheduled_datetime: string;
    status: string;
    total_price?: number;
    parent_id?: string;
    session_type?: string;
    session_mode?: string;
    focus_area?: string | null;
    current_participants?: number;
    max_participants?: number;
    partner_invite_code?: string | null;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | { id: string; first_name?: string; last_name?: string; school?: string }[];
    facilities?: { id: string; name?: string; address?: string } | { id: string; name?: string; address?: string }[];
    session_participants?: Array<{ youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }>;
  }>;

  // Fetch all participants for upcoming sessions (RLS only returns current user's kids; admin gives full list for the tile)
  let allParticipantsBySession: Record<string, string[]> = {};
  if (upcoming.length > 0) {
    const admin = createAdminClient(tenant.slug);
    const ids = upcoming.map((s) => s.id);
    const { data: allParts } = await admin
      .from('session_participants')
      .select('session_id, youth_wrestlers(first_name, last_name)')
      .in('session_id', ids);
    for (const p of allParts ?? []) {
      const row = p as { session_id: string; youth_wrestlers?: { first_name?: string; last_name?: string } | null };
      const yw = row.youth_wrestlers;
      const name = yw ? `${yw.first_name ?? ''} ${yw.last_name ?? ''}`.trim() : null;
      if (name && row.session_id) {
        if (!allParticipantsBySession[row.session_id]) allParticipantsBySession[row.session_id] = [];
        allParticipantsBySession[row.session_id].push(name);
      }
    }
  }

  const nextSession = upcoming[0];

  const nextSessionByWrestler: Record<string, string> = {};
  for (const s of upcoming) {
    const parts = (s.session_participants ?? []) as Array<{ youth_wrestler_id?: string }>;
    for (const p of parts) {
      const yid = p.youth_wrestler_id;
      if (yid && !nextSessionByWrestler[yid]) nextSessionByWrestler[yid] = s.scheduled_datetime;
    }
  }

  const toBookingSession = (s: (typeof upcoming)[0]): BookingSession => {
    const a = s.athletes;
    const coach = Array.isArray(a) ? a[0] : a;
    const f = s.facilities;
    const fac = Array.isArray(f) ? f[0] : f;
    const wrestlers =
      allParticipantsBySession[s.id] ??
      (s.session_participants ?? []).map((p) => {
        const yw = p.youth_wrestlers;
        const o = Array.isArray(yw) ? yw[0] : yw;
        return o ? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() : null;
      }).filter(Boolean) as string[];
    return {
      id: s.id,
      scheduled_datetime: s.scheduled_datetime,
      status: s.status,
      total_price: s.total_price ?? 0,
      session_type: s.session_type,
      session_mode: s.session_mode,
      focus_area: s.focus_area ?? null,
      partner_invite_code: s.partner_invite_code ?? null,
      isTentative: false,
      isOwner: s.parent_id === user.id,
      coach: {
        name: coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() : '—',
        school: coach?.school ?? '',
        id: coach?.id ?? '',
        photo_url: (coach as { photo_url?: string })?.photo_url,
      },
      facility: fac?.name ?? '—',
      facility_id: (fac as { id?: string })?.id ?? null,
      wrestlers,
      primaryWrestlerId: (s.session_participants ?? [])[0] ? ((s.session_participants ?? [])[0] as { youth_wrestler_id?: string }).youth_wrestler_id : null,
    };
  };

  // Admin: convert admin-fetched session row to BookingSession for card display
  const adminRowToBookingSession = (s: AdminUpcomingRow): BookingSession => {
    const a = s.athletes;
    const coach = Array.isArray(a) ? a[0] : a;
    const f = s.facilities;
    const fac = Array.isArray(f) ? f[0] : f;
    const wrestlers = (s.session_participants ?? [])
      .map((p) => {
        const yw = p.youth_wrestlers;
        const o = Array.isArray(yw) ? yw[0] : yw;
        return o ? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() : null;
      })
      .filter(Boolean) as string[];
    return {
      id: s.id,
      scheduled_datetime: s.scheduled_datetime,
      status: s.status,
      total_price: s.total_price ?? 0,
      session_type: s.session_type,
      session_mode: s.session_mode,
      focus_area: s.focus_area ?? null,
      partner_invite_code: s.partner_invite_code ?? null,
      isTentative: false,
      isOwner: s.parent_id === user.id,
      coach: {
        name: coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() : '—',
        school: coach?.school ?? '',
        id: coach?.id ?? '',
        photo_url: coach?.photo_url ?? null,
      },
      facility: fac?.name ?? '—',
      facility_id: fac?.id ?? null,
      wrestlers,
      primaryWrestlerId: (s.session_participants ?? [])[0]?.youth_wrestler_id ?? null,
    };
  };

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <h1 className="text-2xl font-serif font-bold text-foreground md:text-3xl">Home</h1>
      <p className="text-muted-foreground mt-1 text-sm md:text-base">
        Next session, quick actions, and your wrestlers
      </p>

      {/* Upcoming session(s): when admin, show all as cards; otherwise show family next session */}
      <section className="mt-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          {isAdmin ? 'All sessions (scheduled & pending)' : 'Next Session'}
        </h2>
        {isAdmin && allUpcomingForAdmin.length > 0 ? (
          <div className="space-y-4">
            {allUpcomingForAdmin.map((s) => (
              <BookingCard key={s.id} session={adminRowToBookingSession(s)} />
            ))}
          </div>
        ) : isAdmin && allUpcomingForAdmin.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No upcoming sessions.</p>
              <Link href="/admin/sessions/create">
                <Button className="min-h-[44px] touch-manipulation">Create session</Button>
              </Link>
            </CardContent>
          </Card>
        ) : nextSession ? (
          <BookingCard session={toBookingSession(nextSession)} />
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No upcoming sessions.</p>
              <Link href="/training">
                <Button className="min-h-[44px] touch-manipulation">Find training</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* B. Find sessions — one primary path */}
      <section className="mb-6">
        <Link href="/training">
          <Button className="w-full min-h-[52px] touch-manipulation text-base font-medium">
            <Calendar className="h-5 w-5 shrink-0 mr-2" />
            Find sessions
          </Button>
        </Link>
      </section>

      {/* C. Your Wrestlers (only RLS-scoped; Add Wrestler lives in Account) */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Your Wrestlers</h2>
        {youthWrestlers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {youthWrestlers.map((wrestler: YouthWrestler) => {
              const sessionsCompleted = sessionCounts[wrestler.id] || 0;
              return (
                <Card key={wrestler.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <ProfileImage
                        src={wrestler.photo_url}
                        alt={`${wrestler.first_name} ${wrestler.last_name}`}
                        focusX={wrestler.photo_focus_x ?? 50}
                        focusY={wrestler.photo_focus_y ?? 25}
                        className="w-16 h-16 sm:w-20 sm:h-20 shrink-0"
                        fallbackIconClassName="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground"
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg sm:text-xl">
                          {wrestler.first_name} {wrestler.last_name}
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-sm">
                          {wrestler.age != null && <span>{wrestler.age}</span>}
                          {wrestler.weight_class && <span> · {wrestler.weight_class} lbs</span>}
                        </CardDescription>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Next session: {nextSessionByWrestler[wrestler.id] ? formatEST(new Date(nextSessionByWrestler[wrestler.id]), 'MMM d, h:mm a') : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last session: {lastSessionByWrestler[wrestler.id] ? formatEST(new Date(lastSessionByWrestler[wrestler.id]), 'MMM d, h:mm a') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                      <Link href="/training" className="flex-1 min-w-0">
                        <Button className="w-full min-h-[44px] touch-manipulation">
                          <Calendar className="h-4 w-4 mr-2 shrink-0" />
                          Book training
                        </Button>
                      </Link>
                      <Link href={`/wrestlers/${wrestler.id}/edit`} className="shrink-0">
                        <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px] touch-manipulation">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <User className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Add your first wrestler</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md text-sm">
                Create a profile to start booking training with coaches.
              </p>
              <Link href="/wrestlers/add">
                <Button className="min-h-[48px] touch-manipulation">Add wrestler</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
