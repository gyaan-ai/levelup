import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Edit, User, Calendar, CalendarSearch, Users } from 'lucide-react';
import { YouthWrestler } from '@/types';
import { BookingCard, type BookingSession } from '@/app/(parent)/bookings/booking-card';
import { CoachSessionBadge } from '@/components/coach-session-badge';
import { ProfileImage } from '@/components/profile-image';

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

  const { data: youthWrestlersRaw } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .order('created_at', { ascending: false });
  const youthWrestlers = [...new Map((youthWrestlersRaw ?? []).map((yw: YouthWrestler) => [yw.id, yw])).values()];
  const youthWrestlerIds = youthWrestlers.map((yw) => yw.id);

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
  }

  const nowISO = new Date().toISOString();
  const { data: upcomingSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id,
          scheduled_datetime,
          status,
          total_price,
          session_type,
          session_mode,
          current_participants,
          max_participants,
          partner_invite_code,
          athletes(id, first_name, last_name, school),
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
    session_type?: string;
    session_mode?: string;
    current_participants?: number;
    max_participants?: number;
    partner_invite_code?: string | null;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | { id: string; first_name?: string; last_name?: string; school?: string }[];
    facilities?: { id: string; name?: string; address?: string } | { id: string; name?: string; address?: string }[];
    session_participants?: Array<{ youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }>;
  }>;
  const nextSession = upcoming[0];

  const toBookingSession = (s: (typeof upcoming)[0]): BookingSession => {
    const a = s.athletes;
    const coach = Array.isArray(a) ? a[0] : a;
    const f = s.facilities;
    const fac = Array.isArray(f) ? f[0] : f;
    const wrestlers = (s.session_participants ?? []).map((p) => {
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
      partner_invite_code: s.partner_invite_code ?? null,
      isTentative: false,
      coach: {
        name: coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() : '—',
        school: coach?.school ?? '',
        id: coach?.id ?? '',
      },
      facility: fac?.name ?? '—',
      wrestlers,
    };
  };

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <h1 className="text-2xl font-serif font-bold text-foreground md:text-3xl">Home</h1>
      <p className="text-muted-foreground mt-1 text-sm md:text-base">
        Your wrestlers and next session
      </p>

      {youthWrestlers.length > 0 && (
        <div className="mt-4 mb-2">
          <Link href="/wrestlers/add" className="block w-full sm:w-auto sm:inline-block">
            <Button variant="outline" className="w-full min-h-[44px] touch-manipulation sm:w-auto">
              <Plus className="h-4 w-4 mr-2 shrink-0" />
              Add wrestler
            </Button>
          </Link>
        </div>
      )}

      {youthWrestlers.length > 0 ? (
        <>
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Your wrestlers</h2>
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
                          focusY={wrestler.photo_focus_y ?? 50}
                          className="w-16 h-16 sm:w-20 sm:h-20 shrink-0"
                          fallbackIconClassName="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg sm:text-xl">
                              {wrestler.first_name} {wrestler.last_name}
                            </CardTitle>
                            <CoachSessionBadge totalSessions={sessionsCompleted} size="sm" />
                          </div>
                          <CardDescription className="mt-0.5 text-sm">
                            {wrestler.age && <span>{wrestler.age} years</span>}
                            {wrestler.weight_class && <span> • {wrestler.weight_class}</span>}
                            {wrestler.skill_level && (
                              <span className="capitalize"> • {wrestler.skill_level}</span>
                            )}
                          </CardDescription>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''} completed
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                        <Link href={`/browse?youthWrestlerId=${wrestler.id}`} className="flex-1 min-w-0">
                          <Button className="w-full min-h-[44px] touch-manipulation">
                            <Calendar className="h-4 w-4 mr-2 shrink-0" />
                            Book session
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
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Next session</h2>
            {nextSession ? (
              <BookingCard session={toBookingSession(nextSession)} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground mb-4">No upcoming sessions.</p>
                  <Link href="/find-training">
                    <Button className="min-h-[44px] touch-manipulation">Find training</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Quick actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/browse">
                <Button variant="outline" className="w-full min-h-[48px] touch-manipulation flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <Calendar className="h-5 w-5 shrink-0" />
                  <span>Book private</span>
                </Button>
              </Link>
              <Link href="/find-training">
                <Button variant="outline" className="w-full min-h-[48px] touch-manipulation flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <CalendarSearch className="h-5 w-5 shrink-0" />
                  <span>Find partner session</span>
                </Button>
              </Link>
              <Link href="/find-training">
                <Button variant="outline" className="w-full min-h-[48px] touch-manipulation flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <Users className="h-5 w-5 shrink-0" />
                  <span>Join small group</span>
                </Button>
              </Link>
            </div>
          </section>
        </>
      ) : (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Add your first wrestler</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md text-sm">
              Create a profile to start booking training with coaches.
            </p>
            <Link href="/wrestlers/add">
              <Button size="lg" className="min-h-[48px] touch-manipulation">
                <Plus className="h-4 w-4 mr-2" />
                Add wrestler
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
