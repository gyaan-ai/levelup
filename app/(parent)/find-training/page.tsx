import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { toZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { APP_TIMEZONE } from '@/lib/format-date';
import { FindTrainingClient } from './find-training-client';

export const metadata = {
  title: 'Find training',
  description: 'Search open sessions by date, time, and location.',
};

export default async function FindTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; location?: string }>;
}) {
  const sp = await searchParams;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/find-training');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'athlete') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin' && userData?.role !== 'youth_wrestler') redirect('/dashboard');

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, school, address')
    .order('name');

  let sessions: Array<{
    id: string;
    scheduled_datetime: string;
    session_type: string | null;
    session_mode: string | null;
    focus_area: string | null;
    current_participants: number | null;
    max_participants: number | null;
    total_price: number | null;
    price_per_participant: number | null;
    athlete_id: string;
    facility_id: string;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | null;
    facilities?: { id: string; name?: string; address?: string } | null;
  }> = [];

  const dateParam = sp.date;
  if (dateParam) {
    const d = new Date(dateParam);
    if (!Number.isNaN(d.getTime())) {
      const dateOnly = dateParam.split('T')[0];
      const dayStart = `${dateOnly}T00:00:00.000Z`;
      const dayEnd = `${dateOnly}T23:59:59.999Z`;

      const baseQuery = () => {
        let q = supabase
          .from('sessions')
          .select(`
            id,
            scheduled_datetime,
            session_type,
            session_mode,
            focus_area,
            current_participants,
            max_participants,
            total_price,
            price_per_participant,
            athlete_id,
            facility_id,
            athletes(id, first_name, last_name, school),
            facilities(id, name, address)
          `)
          .in('status', ['scheduled', 'pending_payment'])
          .gte('scheduled_datetime', dayStart)
          .lte('scheduled_datetime', dayEnd);
        if (sp.location && sp.location !== 'all') {
          q = q.eq('facility_id', sp.location);
        }
        return q;
      };

      const [groupRes, partnerRes] = await Promise.all([
        baseQuery().in('session_type', ['group', 'small_group']).order('scheduled_datetime', { ascending: true }),
        baseQuery().eq('session_mode', 'partner-open').order('scheduled_datetime', { ascending: true }),
      ]);

      const seen = new Set<string>();
      let list: typeof sessions = [];
      for (const row of [...(groupRes.data ?? []), ...(partnerRes.data ?? [])]) {
        const r = row as unknown as (typeof sessions)[0];
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

      const current = (s: { current_participants?: number | null; max_participants?: number | null }) =>
        s.current_participants ?? 0;
      const max = (s: { max_participants?: number | null }) => s.max_participants ?? 1;
      sessions = list.filter((s) => current(s) < max(s));
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Find training</h1>
        <p className="text-muted-foreground mt-1">
          Search by date and time to see all open sessions. Filter by location.
        </p>
      </div>
      <FindTrainingClient
        facilities={facilities ?? []}
        initialSessions={sessions}
        initialDate={dateParam ?? ''}
        initialTime={sp.time ?? 'any'}
        initialLocation={sp.location ?? 'all'}
      />
    </div>
  );
}
