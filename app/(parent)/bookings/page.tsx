import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { BookingCard, type BookingSession } from './booking-card';

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
  // parent and admin can both access (admin sees empty state if no bookings)

  const [sessionsRes, creditsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select(`
        id,
        scheduled_datetime,
        status,
        total_price,
        session_type,
        session_mode,
        partner_invite_code,
        athletes(id, first_name, last_name, school, photo_url),
        facilities(id, name, address),
        session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))
      `)
      .eq('parent_id', user.id)
      .order('scheduled_datetime', { ascending: false }),
    supabase
      .from('credits')
      .select('remaining, expires_at')
      .eq('parent_id', user.id)
      .gt('remaining', 0),
  ]);

  const sessions = sessionsRes.data;
  const error = sessionsRes.error;

  if (error) {
    console.error('Bookings fetch error:', error);
  }

  // Calculate credit balance
  const now = new Date();
  const availableCredits = (creditsRes.data || []).filter(c => 
    c.remaining > 0 && (!c.expires_at || new Date(c.expires_at) > now)
  );
  const creditBalance = availableCredits.reduce((sum, c) => sum + Number(c.remaining), 0);

  const all = (sessions || []) as Array<{
    id: string;
    scheduled_datetime: string;
    status: string;
    total_price: number;
    session_type?: string;
    session_mode?: string;
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

  // Transform sessions for BookingCard
  const transformSession = (s: (typeof all)[0]): BookingSession => ({
    id: s.id,
    scheduled_datetime: s.scheduled_datetime,
    status: s.status,
    total_price: s.total_price,
    session_type: s.session_type,
    session_mode: s.session_mode,
    partner_invite_code: s.partner_invite_code,
    coach: coach(s),
    facility: facility(s),
    wrestlers: wrestlers(s),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
          <p className="text-muted-foreground">
            Upcoming and past sessions for your wrestlers
          </p>
        </div>
        {creditBalance > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3 px-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Credit Balance</p>
                <p className="text-xl font-bold text-primary">${creditBalance.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming sessions. <Link href="/browse" className="text-primary underline">Browse coaches</Link> to book.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcoming.map((s) => (
                <BookingCard key={s.id} session={transformSession(s)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Past</h2>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No past sessions yet.</p>
          ) : (
            <div className="space-y-4">
              {past.map((s) => (
                <BookingCard key={s.id} session={transformSession(s)} isPast />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
