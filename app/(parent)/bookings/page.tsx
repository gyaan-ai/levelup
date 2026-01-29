import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar, User, MapPin, MessageCircle } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';

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

  if (userData?.role !== 'parent') {
    if (userData?.role === 'athlete') redirect('/athlete-dashboard');
    if (userData?.role === 'admin') redirect('/admin');
    redirect('/browse');
  }

  const { data: sessions, error } = await supabase
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
    .order('scheduled_datetime', { ascending: false });

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
    partner_invite_code?: string | null;
    athletes?: { id: string; first_name: string; last_name: string; school: string; photo_url?: string } | { id: string; first_name: string; last_name: string; school: string; photo_url?: string }[];
    facilities?: { id: string; name: string; address?: string } | { id: string; name: string; address?: string }[];
    session_participants?: Array<{
      youth_wrestler_id: string;
      youth_wrestlers?: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null;
    }>;
  }>;

  const now = new Date().toISOString();
  const upcoming = all.filter(
    (s) =>
      (s.status === 'scheduled' || s.status === 'pending_payment') &&
      s.scheduled_datetime >= now
  );
  const past = all.filter(
    (s) =>
      s.status === 'completed' ||
      s.status === 'cancelled' ||
      s.status === 'no-show' ||
      s.scheduled_datetime < now
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

  const statusBadge = (status: string) => {
    if (status === 'scheduled') return <Badge>Scheduled</Badge>;
    if (status === 'pending_payment') return <Badge variant="secondary">Pending payment</Badge>;
    if (status === 'completed') return <Badge variant="default">Completed</Badge>;
    if (status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>;
    if (status === 'no-show') return <Badge variant="secondary">No-show</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
        <p className="text-muted-foreground">
          Upcoming and past sessions for your wrestlers
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming sessions. <Link href="/browse" className="text-primary underline">Browse wrestlers</Link> to book.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcoming.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {new Date(s.scheduled_datetime).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(s.scheduled_datetime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {' · '}
                          <MapPin className="h-4 w-4 inline" />
                          {facility(s)}
                        </p>
                        <p className="text-sm flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {coach(s).name}
                          {coach(s).school && (
                            <span className="flex items-center gap-1">
                              <SchoolLogo school={coach(s).school} size="sm" />
                              ({coach(s).school})
                            </span>
                          )}
                        </p>
                        {wrestlers(s).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Wrestler(s): {wrestlers(s).join(', ')}
                          </p>
                        )}
                        <div className="pt-2">{statusBadge(s.status)}</div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className="text-xl font-bold">${Number(s.total_price).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{s.session_type ?? '—'}</p>
                        <div className="flex gap-2">
                          <Link href={`/messages/${s.id}`}>
                            <Button variant="outline" size="sm">
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Message
                            </Button>
                          </Link>
                          {coach(s).id && (
                            <Link href={`/book/${coach(s).id}`}>
                              <Button variant="outline" size="sm">Book again</Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                <Card key={s.id} className="bg-muted/20">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {new Date(s.scheduled_datetime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(s.scheduled_datetime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {' · '}
                          {facility(s)} · {coach(s).name}
                        </p>
                        {wrestlers(s).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Wrestler(s): {wrestlers(s).join(', ')}
                          </p>
                        )}
                        <div className="pt-2">{statusBadge(s.status)}</div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className="font-bold">${Number(s.total_price).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{s.session_type ?? '—'}</p>
                        <Link href={`/messages/${s.id}`}>
                          <Button variant="outline" size="sm">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
