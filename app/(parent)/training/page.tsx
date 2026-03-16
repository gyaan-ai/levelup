import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { toZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { APP_TIMEZONE } from '@/lib/format-date';
import { Athlete } from '@/types';
import { TrainingClient } from './training-client';

export const metadata = {
  title: 'Training | The Guild',
  description: 'Find and book sessions. Filter by day, time, facility, and coach.',
};

type SessionRow = {
  id: string;
  scheduled_datetime: string;
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
  athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | null;
  facilities?: { id: string; name?: string; address?: string } | null;
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

  const athletesWithNext = athletesList.map((a) => ({
    ...a,
    nextAvailable: nextByAthlete.get(a.id) ?? null,
  }));

  // Sessions list: smart default = next 7 days when no date; optional filters for facility/coach/time
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
        end.setDate(end.getDate() + 7);
        return end.toISOString();
      })();

  const baseQuery = () => {
    let q = supabase
      .from('sessions')
      .select(`
        id, scheduled_datetime, session_type, session_mode, join_policy, focus_area,
        current_participants, max_participants, total_price, price_per_participant,
        athlete_id, facility_id, athletes(id, first_name, last_name, school, photo_url), facilities(id, name, address)
      `)
      .in('status', ['scheduled', 'pending_payment'])
      .gte('scheduled_datetime', dayStart)
      .lte('scheduled_datetime', dayEnd);
    if (sp.location && sp.location !== 'all') q = q.eq('facility_id', sp.location);
    if (sp.coach && sp.coach !== 'all') q = q.eq('athlete_id', sp.coach);
    return q;
  };

  const [groupRes, partnerRes] = await Promise.all([
    baseQuery().in('session_type', ['group', 'small_group']).order('scheduled_datetime', { ascending: true }),
    baseQuery().eq('session_mode', 'partner-open').order('scheduled_datetime', { ascending: true }),
  ]);
  const seen = new Set<string>();
  let list: SessionRow[] = [];
  for (const row of [...(groupRes.data ?? []), ...(partnerRes.data ?? [])]) {
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
  availabilitySessions = list.filter(
    (s) =>
      (s.current_participants ?? 0) < (s.max_participants ?? 1) &&
      ((s as { join_policy?: string }).join_policy === 'public' || (s as { join_policy?: string }).join_policy === 'invite_only')
  );

  const isAdmin = userData?.role === 'admin';

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl mb-1">Training</h1>
      <p className="text-muted-foreground text-sm md:text-base mb-6">
        Find sessions to join or browse coaches to book private
      </p>
      <TrainingClient
        initialTab={tab}
        athletesWithNext={athletesWithNext}
        isAdmin={!!isAdmin}
        facilities={facilities ?? []}
        availabilitySessions={availabilitySessions}
        availabilityDate={sp.date ?? ''}
        availabilityTime={sp.time ?? 'any'}
        availabilityLocation={sp.location ?? 'all'}
        availabilityCoach={sp.coach ?? 'all'}
        coaches={athletesList.map((a) => ({ id: a.id, first_name: a.first_name, last_name: a.last_name, school: a.school }))}
        preselectedWrestlerId={sp.wrestler ?? ''}
      />
    </div>
  );
}
