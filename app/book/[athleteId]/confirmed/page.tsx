import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle, User, Calendar, MapPin, Copy, Share2 } from 'lucide-react';
import { BookingConfirmedClient } from '../booking-confirmed-client';

export default async function BookingConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ sessionId?: string; code?: string; mode?: string }>;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const sessionId = sp?.sessionId;

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) notFound();

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/book/' + athleteId + '/confirmed');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'parent') redirect('/dashboard');

  if (!sessionId) {
    redirect('/dashboard');
  }

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('*, athletes(id, first_name, last_name, school, photo_url), facilities(id, name, address)')
    .eq('id', sessionId)
    .eq('parent_id', user.id)
    .single();

  if (sessionErr || !session) notFound();

  const { data: participants } = await supabase
    .from('session_participants')
    .select('*, youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level)')
    .eq('session_id', sessionId)
    .eq('parent_id', user.id);

  const athlete = session.athletes as { id: string; first_name: string; last_name: string; school: string; photo_url?: string } | null;
  const facility = session.facilities as { id: string; name: string; address?: string } | null;
  const sessionMode = (session as { session_mode?: string }).session_mode ?? 'private';
  const partnerCode = (session as { partner_invite_code?: string }).partner_invite_code ?? sp?.code ?? null;
  const baseUrl = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;
  const joinUrl = partnerCode ? `${baseUrl}/join/${partnerCode}` : null;

  const scheduledAt = session.scheduled_datetime ? new Date(session.scheduled_datetime) : null;
  const dateTime = scheduledAt
    ? `${format(scheduledAt, 'EEEE, MMMM d, yyyy')} at ${format(scheduledAt, 'h:mm a')}`
    : '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-600 mb-4">
            <CheckCircle className="h-10 w-10" />
            <h1 className="text-2xl font-bold text-foreground">
              {sessionMode === 'private' || sessionMode === 'sibling'
                ? 'Session Booked!'
                : 'Session Reserved!'}
            </h1>
          </div>

          {(sessionMode === 'private' || sessionMode === 'sibling') && (
            <>
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  {athlete?.photo_url ? (
                    <img src={athlete.photo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{athlete?.first_name} {athlete?.last_name}</p>
                    <p className="text-sm text-muted-foreground">{athlete?.school}</p>
                  </div>
                </div>
                <p className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {dateTime}
                </p>
                {facility && (
                  <p className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    {facility.name}
                    {facility.address && ` — ${facility.address}`}
                  </p>
                )}
                <p className="text-lg font-semibold">${Number(session.total_price).toFixed(2)}</p>
              </div>
              <div className="flex gap-3">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/dashboard">View My Sessions</Link>
                </Button>
                <Button asChild className="flex-1" style={{ backgroundColor: 'var(--color-levelup-primary)' }}>
                  <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Wrestling+Session&dates=${scheduledAt?.toISOString().replace(/[-:]/g, '').slice(0, 15)}/${scheduledAt?.toISOString().replace(/[-:]/g, '').slice(0, 15)}`} target="_blank" rel="noopener noreferrer">
                    Add to Calendar
                  </a>
                </Button>
              </div>
            </>
          )}

          {sessionMode === 'partner-invite' && joinUrl && (
            <BookingConfirmedClient
              joinUrl={joinUrl}
              dateTime={dateTime}
              facilityName={facility?.name}
              athleteName={`${athlete?.first_name ?? ''} ${athlete?.last_name ?? ''}`.trim()}
              scheduledAt={scheduledAt?.toISOString() ?? ''}
            />
          )}

          {sessionMode === 'partner-open' && (
            <>
              <p className="text-muted-foreground mb-4">
                Your session is open for others to join. You&apos;ll receive notifications when someone requests to join.
              </p>
              <Button asChild>
                <Link href="/partner-sessions">View Open Partner Sessions</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
