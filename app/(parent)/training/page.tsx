import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { toZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { APP_TIMEZONE } from '@/lib/format-date';
import { Athlete } from '@/types';
import { TrainingClient } from './training-client';
import {
  fetchCoachReviewStatsMap,
  mergeCoachReviewStatsIntoAthlete,
  patchSessionsWithCoachReviewStats,
  sortAthletesForBrowse,
} from '@/lib/coach-review-stats';

export const metadata = {
  title: 'Training | The Guild',
  description: 'Find and book sessions. Filter by day, time, facility, and coach.',
};

type SessionRow = {
  id: string;
  scheduled_datetime: string;
  status?: string | null;
  session_type: string | null;
  session_mode: string | null;
  join_policy?: string | null;
  focus_area: string | null;
  current_participants: number | null;
  max_participants: number | null;
  total_price: number | null;
  price_per_participant: number | null;
  athlete_id: string;
  facility_id: string;
  athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string; average_rating?: number; review_count?: number } | null;
  facilities?: { id: string; name?: string; address?: string } | null;
  session_participants?: Array<{
    id: string;
    youth_wrestler_id: string | null;
    youth_wrestlers?: { id: string; first_name?: string; last_name?: string } | null;
  }>;
};

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date?: string; time?: string; location?: string; coach?: string; wrestler?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'sessions';

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'coach') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin' && userData?.role !== 'youth_wrestler') redirect('/dashboard');

  // Fetch parent's wrestlers for "Booked" state check
  const { data: parentWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('id')
    .eq('parent_id', user.id);
  const parentWrestlerIds = (parentWrestlers || []).map((w) => w.id);

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, school, address')
    .order('name');

  const { data: athletes } = await supabase
    .from('athletes')
    .select('*')
    .eq('active', true)
    .order('average_rating', { ascending: false, nullsFirst: true })
    .order('school', { ascending: true });

  const athletesList = (athletes || []) as Athlete[];
  const athleteIds = athletesList.map((a) => a.id);

  const reviewStatsMap = await fetchCoachReviewStatsMap(supabase, athleteIds);
  const athletesMerged = sortAthletesForBrowse(
    athletesList.map((a) => mergeCoachReviewStatsIntoAthlete(a, reviewStatsMap))
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data: slots } = athleteIds.length
    ? await supabase
        .from('athlete_availability_slots')
        .select('athlete_id, slot_date, start_time')
        .in('athlete_id', athleteIds)
        .gte('slot_date', today)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true })
    : { data: [] };

  const nextByAthlete = new Map<string, { slot_date: string; start_time: string }>();
  for (const row of slots ?? []) {
    const r = row as { athlete_id: string; slot_date: string; start_time: string };
    if (!nextByAthlete.has(r.athlete_id)) nextByAthlete.set(r.athlete_id, { slot_date: r.slot_date, start_time: r.start_time });
  }

  // Fallback: coaches with no availability slots — use their earliest upcoming session (e.g. small group)
  const nowIso = new Date().toISOString();
  const { data: upcomingSessions } = athleteIds.length
    ? await supabase
        .from('sessions')
        .select('athlete_id, scheduled_datetime')
        .in('athlete_id', athleteIds)
        .in('status', ['scheduled', 'pending_payment'])
        .gte('scheduled_datetime', nowIso)
        .order('scheduled_datetime', { ascending: true })
    : { data: [] };
  for (const row of upcomingSessions ?? []) {
    const r = row as { athlete_id: string; scheduled_datetime: string };
    if (nextByAthlete.has(r.athlete_id)) continue;
    const zoned = toZonedTime(new Date(r.scheduled_datetime), APP_TIMEZONE);
    const y = zoned.getFullYear();
    const m = zoned.getMonth() + 1;
    const day = zoned.getDate();
    const slotDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const startTime = `${String(zoned.getHours()).padStart(2, '0')}:${String(zoned.getMinutes()).padStart(2, '0')}`;
    nextByAthlete.set(r.athlete_id, { slot_date: slotDate, start_time: startTime });
  }

  const athletesWithNext = athletesMerged.map((a) => ({
    ...a,
    nextAvailable: nextByAthlete.get(a.id) ?? null,
  }));

  // Sessions list: smart default = next 14 days when no date; optional filters for facility/coach/time
  let availabilitySessions: SessionRow[] = [];
  const dateParam = sp.date;
  const now = new Date();
  const dayStart = dateParam
    ? (() => {
        const d = new Date(dateParam);
        if (Number.isNaN(d.getTime())) return now.toISOString();
        const dateOnly = dateParam.split('T')[0];
        return `${dateOnly}T00:00:00.000Z`;
      })()
    : now.toISOString();
  const dayEnd = dateParam
    ? (() => {
        const d = new Date(dateParam);
        if (Number.isNaN(d.getTime())) return now.toISOString();
        const dateOnly = dateParam.split('T')[0];
        return `${dateOnly}T23:59:59.999Z`;
      })()
    : (() => {
        const end = new Date(now);
        end.setDate(end.getDate() + 14);
        return end.toISOString();
      })();
  // Past/completed sessions: when no date = last 14 days; when date = that day
  const pastDayStart = dateParam
    ? dayStart
    : (() => {
        const start = new Date(now);
        start.setDate(start.getDate() - 14);
        return start.toISOString();
      })();
  const pastDayEnd = dateParam ? dayEnd : now.toISOString();

  // Query sessions - use simple select first, then join coach/facility data
  const baseSelect = `
    id, scheduled_datetime, status, session_type, session_mode, join_policy, focus_area,
    current_participants, max_participants, total_price, price_per_participant, duration_minutes,
    athlete_id, facility_id,
    athletes:athlete_id(id, first_name, last_name, school, photo_url, average_rating, review_count),
    facilities:facility_id(id, name, address),
    session_participants(id, youth_wrestler_id, youth_wrestlers:youth_wrestler_id(id, first_name, last_name))
  `;
  const sessionQuery = (start: string, end: string) =>
    supabase.from('sessions').select(baseSelect).gte('scheduled_datetime', start).lte('scheduled_datetime', end);
  const withOptFilters = (q: ReturnType<typeof sessionQuery>) => {
    if (sp.location && sp.location !== 'all') q = q.eq('facility_id', sp.location);
    if (sp.coach && sp.coach !== 'all') q = q.eq('athlete_id', sp.coach);
    return q;
  };

  // Query only UPCOMING sessions (scheduled or pending_payment)
  const { data: upcomingData, error: upcomingError } = await withOptFilters(sessionQuery(dayStart, dayEnd))
    .in('status', ['scheduled', 'pending_payment'])
    .order('scheduled_datetime', { ascending: true });
  
  
  
  const seen = new Set<string>();
  let list: SessionRow[] = [];
  for (const row of (upcomingData ?? [])) {
    const r = row as unknown as SessionRow;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    list.push(r);
  }
  list.sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime));
  const timeWindow = sp.time;
  if (timeWindow && timeWindow !== 'any') {
    const [startHour, endHour] =
      timeWindow === 'morning' ? [6, 12] : timeWindow === 'afternoon' ? [12, 17] : timeWindow === 'evening' ? [17, 21] : [0, 24];
    list = list.filter((s) => {
      const t = toZonedTime(new Date(s.scheduled_datetime), APP_TIMEZONE);
      const h = t.getHours();
      return h >= startHour && h < endHour;
    });
  }
  // Show ALL sessions - we'll display badges to indicate public vs invite-only
  availabilitySessions = list;

  availabilitySessions = patchSessionsWithCoachReviewStats(availabilitySessions, reviewStatsMap);

  const isAdmin = userData?.role === 'admin';

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Training</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Find and book sessions</p>
      </div>
      <div className="px-4">
      <TrainingClient
        key={`training-${tab}-${sp.coach ?? 'all'}`}
        initialTab={tab}
        athletesWithNext={athletesWithNext}
        isAdmin={!!isAdmin}
        facilities={facilities ?? []}
        availabilitySessions={availabilitySessions}
        availabilityDate={sp.date ?? ''}
        availabilityTime={sp.time ?? 'any'}
        availabilityLocation={sp.location ?? 'all'}
        availabilityCoach={sp.coach ?? 'all'}
        coaches={athletesMerged.map((a) => ({ id: a.id, first_name: a.first_name, last_name: a.last_name, school: a.school }))}
        preselectedWrestlerId={sp.wrestler ?? ''}
        parentWrestlerIds={parentWrestlerIds}
      />
      </div>
    </div>
  );
}
