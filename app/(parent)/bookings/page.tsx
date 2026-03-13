import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { BookingCard, type BookingSession } from './booking-card';
import { BookingsTabsClient } from './bookings-tabs-client';

export default async function MyBookingsPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role === 'athlete') redirect('/athlete-dashboard');
  // parent and admin can both access; parents see all sessions for their kids (shared with linked parent)

  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('id')
    .order('created_at', { ascending: false });
  const youthWrestlerIds = (youthWrestlers ?? []).map((yw: { id: string }) => yw.id);

  let familySessionIds: string[] = [];
  if (youthWrestlerIds.length > 0) {
    const { data: partRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('youth_wrestler_id', youthWrestlerIds);
    familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
  }

  const { data: sessions, error } = familySessionIds.length > 0
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
          parent_id,
          athletes(id, first_name, last_name, school, photo_url),
          facilities(id, name, address),
          session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))
        `)
        .in('id', familySessionIds)
        .order('scheduled_datetime', { ascending: false })
    : { data: [] };

  if (error) {
    console.error('Bookings fetch error:', error);
  }

  const all = (sessions || []) as Array<{
    id: string;
    scheduled_datetime: string;
    status: string;
    total_price: number;
    session_type?: string;
    session_mode?: string;
    current_participants?: number;
    max_participants?: number;
    partner_invite_code?: string | null;
    athletes?: { id: string; first_name: string; last_name: string; school: string; photo_url?: string } | { id: string; first_name: string; last_name: string; school: string; photo_url?: string }[];
    facilities?: { id: string; name: string; address?: string } | { id: string; name: string; address?: string }[];
    session_participants?: Array<{
      youth_wrestler_id: string;
      youth_wrestlers?: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null;
    }>;
  }>;

  const nowISO = new Date().toISOString();
  const upcoming = all.filter(
    (s) =>
      (s.status === 'scheduled' || s.status === 'pending_payment') &&
      s.scheduled_datetime >= nowISO
  );
  const past = all.filter(
    (s) =>
      s.status === 'completed' ||
      s.status === 'cancelled' ||
      s.status === 'no-show' ||
      s.scheduled_datetime < nowISO
  );

  const coach = (s: (typeof all)[0]) => {
    const a = s.athletes;
    if (!a) return { name: '—', school: '', id: '' };
    const o = Array.isArray(a) ? a[0] : a;
    return {
      name: o ? `${o.first_name} ${o.last_name}` : '—',
      school: o?.school ?? '',
      id: o?.id ?? '',
    };
  };

  const facility = (s: (typeof all)[0]) => {
    const f = s.facilities;
    if (!f) return '—';
    const o = Array.isArray(f) ? f[0] : f;
    return o?.name ?? '—';
  };

  const facilityId = (s: (typeof all)[0]) => {
    const f = s.facilities;
    if (!f) return null;
    const o = Array.isArray(f) ? f[0] : f;
    return (o as { id?: string })?.id ?? null;
  };

  const primaryWrestlerId = (s: (typeof all)[0]) => {
    const parts = s.session_participants ?? [];
    const first = parts[0];
    return first ? (first as { youth_wrestler_id?: string }).youth_wrestler_id ?? null : null;
  };

  const wrestlers = (s: (typeof all)[0]) => {
    const parts = s.session_participants ?? [];
    return parts
      .map((p) => {
        const yw = p.youth_wrestlers;
        const o = Array.isArray(yw) ? yw[0] : yw;
        return o ? `${o.first_name} ${o.last_name}` : null;
      })
      .filter(Boolean) as string[];
  };

  // Session is not "tentative" just because it's a group with open spots — once you're booked, you're confirmed
  const isTentative = (_s: (typeof all)[0]) => false;

  // Transform sessions for BookingCard (include facility_id and primaryWrestlerId for Book again)
  const transformSession = (s: (typeof all)[0]): BookingSession => ({
    id: s.id,
    scheduled_datetime: s.scheduled_datetime,
    status: s.status,
    total_price: s.total_price,
    session_type: s.session_type,
    session_mode: s.session_mode,
    partner_invite_code: s.partner_invite_code,
    isTentative: isTentative(s),
    coach: coach(s),
    facility: facility(s),
    facility_id: facilityId(s),
    wrestlers: wrestlers(s),
    primaryWrestlerId: primaryWrestlerId(s),
  });

  const upcomingSessions = upcoming.map(transformSession);
  const pastSessions = past.map(transformSession);

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl mb-1">Sessions</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Upcoming and past sessions for your wrestlers
        </p>
      </div>

      <BookingsTabsClient upcoming={upcomingSessions} past={pastSessions} />
    </div>
  );
}
