import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Edit, User, Calendar, DollarSign, Users, UserPlus, FolderOpen } from 'lucide-react';
import { YouthWrestler } from '@/types';
import { Athlete } from '@/types';
import { BookingCard, type BookingSession } from '@/app/(parent)/bookings/booking-card';
import { formatEST } from '@/lib/format-date';
import { CoachSessionBadge } from '@/components/coach-session-badge';
import { ParentDashboardTabs, type ParentDashboardTab } from './parent-dashboard-tabs';
import { BrowseAthletesClient } from '@/app/(parent)/browse/browse-client';
import { FindTrainingClient } from '@/app/(parent)/find-training/find-training-client';
import { SmallGroupSessionsClient } from '@/app/(parent)/small-group-sessions/small-group-sessions-client';
import { startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/format-date';

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date?: string; time?: string; location?: string }>;
}) {
  const sp = await searchParams;
  const tabParam = sp.tab;
  const activeTab: ParentDashboardTab = ['scheduled', 'book', 'find-training', 'group'].includes(tabParam ?? '')
    ? (tabParam as ParentDashboardTab)
    : 'scheduled';

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) {
    redirect('/404');
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'athlete') redirect('/athlete-dashboard');

  type ScheduledData = {
    youthWrestlers: YouthWrestler[];
    youthWrestlerIds: string[];
    familySessionIds: string[];
    sessionCounts: Record<string, number>;
    upcomingSessions: Array<{
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
    totalSpent: number;
    coachTotals: Array<{ id: string; name: string; total: number }>;
    byKid: Record<string, number>;
    byKidByMonth: Record<string, Record<string, number>>;
    last6Months: string[];
    monthLabels: Record<string, string>;
    followedCoaches: Array<{ id: string; name: string; school: string }>;
    openPartnerCount: number | null;
    smallGroupCount: number | null;
  };
  let scheduledData: ScheduledData | null = null;

  if (activeTab === 'scheduled') {
  // Get youth wrestlers (primary or linked parent); dedupe by id
  const { data: youthWrestlersRaw } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .order('created_at', { ascending: false });
  const youthWrestlers = [...new Map((youthWrestlersRaw ?? []).map((yw: YouthWrestler) => [yw.id, yw])).values()];

  const youthWrestlerIds = youthWrestlers.map((yw) => yw.id);

  // Session IDs where any of my kids (primary or linked) participated — shared view for both parents
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

  // Spending: all paid sessions for my kids (whoever booked), exclude refunded
  const { data: paidSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id,
          total_price,
          scheduled_datetime,
          athlete_id,
          refunded_at,
          parent_id,
          athletes(id, first_name, last_name),
          session_participants(youth_wrestler_id)
        `)
        .in('id', familySessionIds)
        .in('status', ['scheduled', 'completed'])
    : { data: [] };

  const nonRefunded = (paidSessions ?? []).filter(
    (s: { refunded_at?: string | null }) => !s.refunded_at
  ) as Array<{
    id: string;
    total_price: number;
    scheduled_datetime: string;
    athlete_id: string;
    athletes?: { id: string; first_name?: string; last_name?: string } | { id: string; first_name?: string; last_name?: string }[];
    session_participants?: Array<{ youth_wrestler_id: string }>;
  }>;

  const totalSpent = nonRefunded.reduce((sum, s) => sum + Number(s.total_price), 0);

  const byCoach: Record<string, { name: string; total: number }> = {};
  for (const s of nonRefunded) {
    const a = s.athletes;
    const coach = Array.isArray(a) ? a[0] : a;
    const name = coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() || 'Coach' : 'Coach';
    if (!byCoach[s.athlete_id]) byCoach[s.athlete_id] = { name, total: 0 };
    byCoach[s.athlete_id].total += Number(s.total_price);
  }
  const coachTotals = Object.entries(byCoach).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);

  const participants = youthWrestlerIds as string[];
  const byKid: Record<string, number> = {};
  const byKidByMonth: Record<string, Record<string, number>> = {};
  for (const yid of participants) {
    byKid[yid] = 0;
    byKidByMonth[yid] = {};
  }
  for (const s of nonRefunded) {
    const parts = s.session_participants ?? [];
    const n = Math.max(1, parts.length);
    const share = Number(s.total_price) / n;
    const month = s.scheduled_datetime.slice(0, 7);
    for (const p of parts) {
      const yid = p.youth_wrestler_id;
      byKid[yid] = (byKid[yid] ?? 0) + share;
      if (!byKidByMonth[yid]) byKidByMonth[yid] = {};
      byKidByMonth[yid][month] = (byKidByMonth[yid][month] ?? 0) + share;
    }
  }

  const last6Months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthLabels: Record<string, string> = {};
  last6Months.forEach((m) => {
    const [y, mo] = m.split('-');
    const date = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
    monthLabels[m] = formatEST(date, 'MMM yy');
  });

  // Followed coaches for dashboard summary
  const { data: followRows } = await supabase
    .from('coach_follows')
    .select('coach_id, athletes(id, first_name, last_name, school)')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);
  const followedCoaches = (followRows ?? []).map((f: { coach_id: string; athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | Array<{ id: string; first_name?: string; last_name?: string; school?: string }> }) => {
    const a = Array.isArray(f.athletes) ? f.athletes[0] : f.athletes;
    return { id: f.coach_id, name: a ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Coach' : 'Coach', school: a?.school ?? '' };
  });

  // Open partner sessions (scheduled in future) count for dashboard summary
  const { count: openPartnerCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('session_mode', 'partner-open')
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', new Date().toISOString())
    .lt('current_participants', 2);

  // Small group sessions this week (for dashboard summary)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const { count: smallGroupCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .in('session_type', ['group', 'small_group'])
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', weekStart.toISOString())
    .lt('scheduled_datetime', weekEnd.toISOString());

  scheduledData = {
    youthWrestlers,
    youthWrestlerIds,
    familySessionIds,
    sessionCounts,
    upcomingSessions: (upcomingSessions ?? []) as ScheduledData['upcomingSessions'],
    totalSpent,
    coachTotals,
    byKid,
    byKidByMonth,
    last6Months,
    monthLabels,
    followedCoaches,
    openPartnerCount: openPartnerCount ?? null,
    smallGroupCount: smallGroupCount ?? null,
  };
  }

  // Book tab: browse coaches
  let athletesWithNext: (Athlete & { nextAvailable?: { slot_date: string; start_time: string } | null })[] = [];
  if (activeTab === 'book') {
    const { data: athletes } = await supabase.from('athletes').select('*').eq('active', true).order('average_rating', { ascending: false, nullsFirst: true }).order('school', { ascending: true });
    const athletesList = (athletes ?? []) as Athlete[];
    const athleteIds = athletesList.map((a) => a.id);
    const today = new Date().toISOString().slice(0, 10);
    const { data: slots } = athleteIds.length ? await supabase.from('athlete_availability_slots').select('athlete_id, slot_date, start_time').in('athlete_id', athleteIds).gte('slot_date', today).order('slot_date', { ascending: true }).order('start_time', { ascending: true }) : { data: [] };
    const nextByAthlete = new Map<string, { slot_date: string; start_time: string }>();
    for (const row of slots ?? []) {
      const r = row as { athlete_id: string; slot_date: string; start_time: string };
      if (!nextByAthlete.has(r.athlete_id)) nextByAthlete.set(r.athlete_id, { slot_date: r.slot_date, start_time: r.start_time });
    }
    athletesWithNext = athletesList.map((a) => ({ ...a, nextAvailable: nextByAthlete.get(a.id) ?? null }));
  }

  // Find training tab: facilities + sessions when date set
  let findTrainingFacilities: Array<{ id: string; name?: string; school?: string; address?: string | null }> = [];
  let findTrainingSessions: Array<{ id: string; scheduled_datetime: string; session_type: string | null; session_mode: string | null; focus_area: string | null; current_participants: number | null; max_participants: number | null; total_price: number | null; price_per_participant: number | null; athlete_id: string; facility_id: string; athletes?: unknown; facilities?: unknown }> = [];
  if (activeTab === 'find-training') {
    const { data: facs } = await supabase.from('facilities').select('id, name, school, address').order('name');
    findTrainingFacilities = facs ?? [];
    const dateParam = sp.date;
    if (dateParam) {
      const d = new Date(dateParam);
      if (!Number.isNaN(d.getTime())) {
        const dateOnly = dateParam.split('T')[0];
        const dayStart = `${dateOnly}T00:00:00.000Z`;
        const dayEnd = `${dateOnly}T23:59:59.999Z`;
        const baseQuery = () => {
          let q = supabase.from('sessions').select('id, scheduled_datetime, session_type, session_mode, join_policy, focus_area, current_participants, max_participants, total_price, price_per_participant, athlete_id, facility_id, athletes(id, first_name, last_name, school), facilities(id, name, address)').in('status', ['scheduled', 'pending_payment']).gte('scheduled_datetime', dayStart).lte('scheduled_datetime', dayEnd);
          if (sp.location && sp.location !== 'all') q = q.eq('facility_id', sp.location);
          return q;
        };
        const [groupRes, partnerRes] = await Promise.all([baseQuery().in('session_type', ['group', 'small_group']).order('scheduled_datetime', { ascending: true }), baseQuery().eq('session_mode', 'partner-open').order('scheduled_datetime', { ascending: true })]);
        const seen = new Set<string>();
        let list: typeof findTrainingSessions = [];
        for (const row of [...(groupRes.data ?? []), ...(partnerRes.data ?? [])]) {
          const r = row as unknown as (typeof findTrainingSessions)[0];
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          list.push(r);
        }
        list.sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime));
        const timeWindow = sp.time;
        if (timeWindow && timeWindow !== 'any') {
          const [startHour, endHour] = timeWindow === 'morning' ? [6, 12] : timeWindow === 'afternoon' ? [12, 17] : timeWindow === 'evening' ? [17, 21] : [0, 24];
          list = list.filter((s) => {
            const t = toZonedTime(new Date(s.scheduled_datetime), APP_TIMEZONE);
            return t.getHours() >= startHour && t.getHours() < endHour;
          });
        }
        findTrainingSessions = list.filter((s) => (s.current_participants ?? 0) < (s.max_participants ?? 1) && (s as { join_policy?: string }).join_policy === 'public');
      }
    }
  }

  // Group tab: small group + partner sessions
  let groupSessions: Parameters<typeof SmallGroupSessionsClient>[0]['sessions'] = [];
  let partnerSessionsList: Parameters<typeof SmallGroupSessionsClient>[0]['partnerSessions'] = [];
  if (activeTab === 'group') {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 0 });
    const { data: sess } = await supabase.from('sessions').select('id, scheduled_datetime, session_type, session_mode, join_policy, focus_area, current_participants, max_participants, total_price, price_per_participant, parent_id, athlete_id, athletes(id, first_name, last_name, school, photo_url), facilities(id, name, address), session_participants(youth_wrestlers(id, first_name, last_name, photo_url))').in('session_type', ['group', 'small_group']).in('status', ['scheduled', 'pending_payment']).gte('scheduled_datetime', weekStart.toISOString()).lte('scheduled_datetime', nextWeekEnd.toISOString()).order('scheduled_datetime', { ascending: true });
    const { data: partnerSess } = await supabase.from('sessions').select('id, scheduled_datetime, session_type, session_mode, join_policy, current_participants, max_participants, total_price, price_per_participant, parent_id, athlete_id, athletes(id, first_name, last_name, school, photo_url), facilities(id, name, address), session_participants(youth_wrestlers(id, first_name, last_name, photo_url, age, weight_class, skill_level))').eq('session_mode', 'partner-open').in('status', ['scheduled', 'pending_payment']).gte('scheduled_datetime', now.toISOString()).order('scheduled_datetime', { ascending: true });
    groupSessions = sess ?? [];
    partnerSessionsList = (partnerSess ?? []).filter((s: { current_participants?: number; max_participants?: number }) => (s.current_participants ?? 1) < (s.max_participants ?? 2));
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {activeTab === 'scheduled' ? 'Your wrestlers and upcoming sessions' : activeTab === 'book' ? 'Find and book coaches' : activeTab === 'find-training' ? 'Search open sessions by date and location' : 'Group and partner sessions'}
        </p>
      </div>
      <ParentDashboardTabs activeTab={activeTab} />

      {activeTab === 'scheduled' && scheduledData && (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div />
        <div className="flex items-center gap-4">
          {scheduledData.youthWrestlers.length > 0 && (
            <Link href="/wrestlers/add">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Another Wrestler
              </Button>
            </Link>
          )}
        </div>
      </div>

      {scheduledData.youthWrestlers.length > 0 ? (
        <>
          {/* Upcoming Sessions first so booked sessions are visible without scrolling */}
          {scheduledData.upcomingSessions.length > 0 ? (
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Upcoming Sessions</CardTitle>
                  <CardDescription>
                    Sessions you&apos;ve booked
                  </CardDescription>
                </div>
<Link href="/dashboard">
                <Button variant="outline" size="sm">View all</Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scheduledData.upcomingSessions.map((s: { id: string; scheduled_datetime: string; status: string; total_price?: number; session_type?: string; session_mode?: string; current_participants?: number; max_participants?: number; partner_invite_code?: string | null; athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | { id: string; first_name?: string; last_name?: string; school?: string }[]; facilities?: { id: string; name?: string; address?: string } | { id: string; name?: string; address?: string }[]; session_participants?: Array<{ youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }> }) => {
                    const a = s.athletes;
                    const coach = Array.isArray(a) ? a[0] : a;
                    const f = s.facilities;
                    const fac = Array.isArray(f) ? f[0] : f;
                    const wrestlers = (s.session_participants ?? []).map((p) => {
                      const yw = p.youth_wrestlers;
                      const o = Array.isArray(yw) ? yw[0] : yw;
                      return o ? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() : null;
                    }).filter(Boolean) as string[];
                    const current = s.current_participants ?? 1;
                    const max = s.max_participants ?? 1;
                    const isGroup = s.session_type === 'group' || s.session_type === 'small_group';
                    const isPartnerOpen = s.session_mode === 'partner-open';
                    const isTentative = (isGroup || isPartnerOpen) && current < max;
                    const sessionForCard: BookingSession = {
                      id: s.id,
                      scheduled_datetime: s.scheduled_datetime,
                      status: s.status,
                      total_price: s.total_price ?? 0,
                      session_type: s.session_type,
                      session_mode: s.session_mode,
                      partner_invite_code: s.partner_invite_code ?? null,
                      isTentative,
                      coach: {
                        name: coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() : '—',
                        school: coach?.school ?? '',
                        id: coach?.id ?? '',
                      },
                      facility: fac?.name ?? '—',
                      wrestlers,
                    };
                    return <BookingCard key={s.id} session={sessionForCard} />;
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Youth Wrestler Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {scheduledData.youthWrestlers.map((wrestler: YouthWrestler) => {
              const sessionsCompleted = scheduledData.sessionCounts[wrestler.id] || 0;
              
              return (
                <Card key={wrestler.id} className="overflow-hidden">
                  <div className="relative h-48 bg-gradient-to-br from-accent/20 to-accent/40">
                    {wrestler.photo_url ? (
                      <img
                        src={wrestler.photo_url}
                        alt={`${wrestler.first_name} ${wrestler.last_name}`}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: `${wrestler.photo_focus_x ?? 50}% ${wrestler.photo_focus_y ?? 50}%` }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <User className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-xl">
                        {wrestler.first_name} {wrestler.last_name}
                      </CardTitle>
                      <CoachSessionBadge totalSessions={sessionsCompleted} size="sm" />
                    </div>
                    <CardDescription>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {wrestler.age && <span>{wrestler.age} years</span>}
                        {wrestler.weight_class && <span>• {wrestler.weight_class}</span>}
                        {wrestler.skill_level && (
                          <span className="capitalize">• {wrestler.skill_level}</span>
                        )}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">
                        {sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''} completed
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/dashboard?tab=book&youthWrestlerId=${wrestler.id}`} className="flex-1">
                        <Button className="w-full">
                          <Calendar className="h-4 w-4 mr-2" />
                          Book Session
                        </Button>
                      </Link>
                      <Link href={`/wrestlers/${wrestler.id}/edit`}>
                        <Button variant="outline" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* My Coaches, Partner Sessions, Small group, Workspaces – quick access */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  My Coaches
                </CardTitle>
                <CardDescription>Coaches you follow. Get notified when they add availability.</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduledData.followedCoaches.length > 0 ? (
                  <ul className="text-sm space-y-1.5 mb-4">
                    {scheduledData.followedCoaches.slice(0, 3).map((c) => (
                      <li key={c.id} className="truncate">{c.name}{c.school ? ` · ${c.school}` : ''}</li>
                    ))}
                    {scheduledData.followedCoaches.length > 3 && (
                      <li className="text-muted-foreground">+{scheduledData.followedCoaches.length - 3} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">Follow coaches from Browse to see them here.</p>
                )}
                <div className="flex gap-2">
                  <Link href="/dashboard?tab=book">
                    <Button variant="outline" size="sm">View all</Button>
                  </Link>
                  <Link href="/dashboard?tab=book">
                    <Button variant="ghost" size="sm">Browse coaches</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Partner Sessions
                </CardTitle>
                <CardDescription>Sessions looking for a partner. Request to join and train together.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {(scheduledData.openPartnerCount ?? 0) > 0
                    ? `${scheduledData.openPartnerCount} open session${(scheduledData.openPartnerCount ?? 0) !== 1 ? 's' : ''} available.`
                    : 'No open partner sessions right now.'}
                </p>
                <Link href="/dashboard?tab=group">
                  <Button variant="outline" size="sm">View open sessions</Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Small group
                </CardTitle>
                <CardDescription>Group sessions this week. Owner can manage join requests.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {(scheduledData.smallGroupCount ?? 0) > 0
                    ? `${scheduledData.smallGroupCount} group session${(scheduledData.smallGroupCount ?? 0) !== 1 ? 's' : ''} this week.`
                    : 'No small group sessions this week.'}
                </p>
                <Link href="/dashboard?tab=group">
                  <Button variant="outline" size="sm">View small group sessions</Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Workspaces
                </CardTitle>
                <CardDescription>Goals, video, session notes, and actions with each coach.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/workspaces">
                  <Button variant="outline" size="sm">View all workspaces</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Spending & reporting – nav link targets #spending */}
          <Card id="spending" className="mb-6 scroll-mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Spending & reporting
              </CardTitle>
              <CardDescription>
                What you&apos;ve spent on sessions (paid and completed). Refunded sessions are excluded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Total spent</p>
                <p className="text-2xl font-bold text-accent">${scheduledData.totalSpent.toFixed(2)}</p>
              </div>

              {scheduledData.coachTotals.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">By coach</p>
                  <ul className="space-y-1.5">
                    {scheduledData.coachTotals.map((c) => (
                      <li key={c.id} className="flex justify-between text-sm">
                        <span>{c.name}</span>
                        <span className="font-medium">${c.total.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {scheduledData.youthWrestlers.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">By wrestler</p>
                  <ul className="space-y-1.5">
                    {scheduledData.youthWrestlers.map((w: YouthWrestler) => (
                      <li key={w.id} className="flex justify-between text-sm">
                        <span>{w.first_name} {w.last_name}</span>
                        <span className="font-medium">${(scheduledData.byKid[w.id] ?? 0).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {scheduledData.youthWrestlers.length > 0 && scheduledData.last6Months.some((m) => scheduledData.youthWrestlers.some((w: YouthWrestler) => (scheduledData.byKidByMonth[w.id]?.[m] ?? 0) > 0)) && (
                <div>
                  <p className="text-sm font-medium mb-2">By wrestler, by month (last 6 months)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium">Wrestler</th>
                          {scheduledData.last6Months.map((m) => (
                            <th key={m} className="text-right py-2 px-2 font-medium text-muted-foreground">
                              {scheduledData.monthLabels[m]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scheduledData.youthWrestlers.map((w: YouthWrestler) => (
                          <tr key={w.id} className="border-b border-border/50">
                            <td className="py-2 pr-4">{w.first_name} {w.last_name}</td>
                            {scheduledData.last6Months.map((m) => (
                              <td key={m} className="text-right py-2 px-2">
                                ${((scheduledData.byKidByMonth[w.id]?.[m] ?? 0)).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {scheduledData.totalSpent === 0 && (
                <p className="text-sm text-muted-foreground">No paid sessions yet. Book a session to see spending here.</p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Sessions empty state - only show when no sessions */}
          {(scheduledData.upcomingSessions.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Sessions</CardTitle>
                <CardDescription>
                  Sessions you&apos;ve booked will appear here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">No upcoming sessions.</p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/dashboard">
                    <Button variant="outline">View bookings</Button>
                  </Link>
                  <Link href="/inbox">
                    <Button variant="outline">Community</Button>
                  </Link>
                  <Link href="/dashboard?tab=book">
                    <Button variant="premium">Find an Elite Coach</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Add Your First Wrestler</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create a profile for your youth wrestler to start training with NCAA wrestlers and elite coaches.
            </p>
            <Link href="/wrestlers/add">
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Wrestler
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </>
      )}

      {activeTab === 'book' && (
        <BrowseAthletesClient initialAthletes={athletesWithNext} isAdmin={userData?.role === 'admin'} />
      )}
      {activeTab === 'find-training' && (
        <FindTrainingClient
          facilities={findTrainingFacilities}
          initialSessions={findTrainingSessions as Parameters<typeof FindTrainingClient>[0]['initialSessions']}
          initialDate={sp.date ?? ''}
          initialTime={sp.time ?? 'any'}
          initialLocation={sp.location ?? 'all'}
          searchBasePath="/dashboard"
        />
      )}
      {activeTab === 'group' && (
        <SmallGroupSessionsClient sessions={groupSessions} partnerSessions={partnerSessionsList} userId={user.id} />
      )}
    </div>
  );
}
