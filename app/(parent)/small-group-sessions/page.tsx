import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Calendar, MapPin, Users } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { SchoolLogo } from '@/components/school-logo';

export default async function SmallGroupSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ requested?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp?.requested === '1';

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/small-group-sessions');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'athlete') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/dashboard');

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 0 });

  // Small group: session_type 'group' or 'small_group', scheduled this week or next
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id,
      scheduled_datetime,
      session_type,
      session_mode,
      current_participants,
      max_participants,
      total_price,
      parent_id,
      athlete_id,
      athletes(id, first_name, last_name, school, photo_url),
      facilities(id, name, address),
      session_participants(youth_wrestlers(id, first_name, last_name))
    `)
    .in('session_type', ['group', 'small_group'])
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', weekStart.toISOString())
    .lte('scheduled_datetime', nextWeekEnd.toISOString())
    .order('scheduled_datetime', { ascending: true });

  const list = (sessions ?? []) as Array<{
    id: string;
    scheduled_datetime: string;
    session_type?: string;
    session_mode?: string;
    current_participants?: number;
    max_participants?: number;
    total_price?: number;
    parent_id?: string;
    athlete_id?: string;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string }[];
    facilities?: { id: string; name?: string; address?: string } | { id: string; name?: string; address?: string }[];
    session_participants?: Array<{ youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }>;
  }>;

  const isOwner = (s: { parent_id?: string; athlete_id?: string }) =>
    s.parent_id === user.id || s.athlete_id === user.id;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          Small group sessions
        </h1>
        <p className="text-muted-foreground mt-1">
          Group sessions for this week and next. Session owner can approve join requests (skill level, weight, etc.).
        </p>
      </div>

      {requested && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400">
          Join request sent. The session owner will review it and may approve based on skill level, weight, etc.
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No small group sessions scheduled for this period.</p>
            <p className="text-sm text-muted-foreground mb-4">
              Book a group session with a coach, or check Open partner sessions for partner sessions looking for someone to join.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button asChild variant="outline">
                <Link href="/browse">Browse coaches</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/partner-sessions">Open partner sessions</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((s) => {
            const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
            const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
            const participants = (s.session_participants ?? []).map((p) => {
              const yw = Array.isArray(p.youth_wrestlers) ? p.youth_wrestlers[0] : p.youth_wrestlers;
              return yw ? `${yw.first_name ?? ''} ${yw.last_name ?? ''}`.trim() : null;
            }).filter(Boolean) as string[];
            const dt = new Date(s.scheduled_datetime);
            const openSlots = (s.max_participants ?? 0) - (s.current_participants ?? 0);

            return (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-lg">
                      {format(dt, 'EEEE, MMM d')} at {format(dt, 'h:mm a')}
                    </CardTitle>
                    {isOwner(s) && (
                      <span className="text-xs font-medium text-accent bg-accent/20 px-2 py-1 rounded">You own this session</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    {coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() : '—'}
                    {coach?.school && (
                      <>
                        <SchoolLogo school={coach.school} size="sm" />
                        <span className="text-muted-foreground">({coach.school})</span>
                      </>
                    )}
                  </p>
                  {fac && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {fac.name}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {(s.current_participants ?? 0)} / {s.max_participants ?? 0} participants
                    {participants.length > 0 && ` · ${participants.join(', ')}`}
                  </p>
                  <p className="text-sm font-medium">${Number(s.total_price ?? 0).toFixed(2)} total</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {isOwner(s) && s.session_mode === 'partner-open' && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/sessions/${s.id}/requests`}>Manage join requests</Link>
                      </Button>
                    )}
                    {!isOwner(s) && openSlots > 0 && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/sessions/${s.id}/request-join`}>Request to join</Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/workspaces/from-session/${s.id}`}>Workspace</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Partner sessions</p>
        <p>Open partner sessions (someone looking for a partner) are listed on the Partner sessions page. You can request to join; the session owner approves based on skill level, weight, etc.</p>
        <Button asChild variant="link" className="px-0 mt-2">
          <Link href="/partner-sessions">View open partner sessions →</Link>
        </Button>
      </div>
    </div>
  );
}
