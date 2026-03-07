import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, MapPin, Users } from 'lucide-react';
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

  // Open partner sessions: someone looking for a partner (any date)
  const { data: partnerSessions } = await supabase
    .from('sessions')
    .select(`
      id,
      scheduled_datetime,
      session_type,
      session_mode,
      current_participants,
      max_participants,
      total_price,
      price_per_participant,
      parent_id,
      athlete_id,
      athletes(id, first_name, last_name, school, photo_url),
      facilities(id, name, address),
      session_participants(youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level))
    `)
    .eq('session_mode', 'partner-open')
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', now.toISOString())
    .order('scheduled_datetime', { ascending: true });

  const partnerList = (partnerSessions ?? []).filter(
    (s: { current_participants?: number; max_participants?: number }) =>
      (s.current_participants ?? 1) < (s.max_participants ?? 2)
  ) as Array<{
    id: string;
    scheduled_datetime: string;
    session_type?: string;
    session_mode?: string;
    current_participants?: number;
    max_participants?: number;
    total_price?: number;
    price_per_participant?: number;
    parent_id?: string;
    athlete_id?: string;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string }[];
    facilities?: { id: string; name?: string; address?: string } | { id: string; name?: string; address?: string }[];
    session_participants?: Array<{ youth_wrestlers?: { first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string } | { first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string }[] }>;
  }>;

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
          Small group & partner sessions
        </h1>
        <p className="text-muted-foreground mt-1">
          Find group sessions (this week and next) or open partner sessions (someone looking for a partner). Request to join; the session owner approves based on skill level, weight, etc.
        </p>
      </div>

      {requested && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400">
          Join request sent. The session owner will review it and may approve based on skill level, weight, etc.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Box 1: Small group sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Small group sessions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Group sessions for this week and next. Session owner can approve join requests.
            </p>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No small group sessions scheduled for this period.</p>
                <Button asChild variant="outline">
                  <Link href="/browse">Browse coaches</Link>
                </Button>
              </div>
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
                    <div key={s.id} className="p-3 border rounded-lg space-y-2">
                      <p className="font-medium text-sm">
                        {format(dt, 'EEEE, MMM d')} at {format(dt, 'h:mm a')}
                        {isOwner(s) && (
                          <span className="ml-2 text-xs font-normal text-accent bg-accent/20 px-2 py-0.5 rounded">You own</span>
                        )}
                      </p>
                      <p className="text-sm flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() : '—'}
                        {coach?.school && <SchoolLogo school={coach.school} size="sm" />}
                      </p>
                      {fac && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {fac.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {(s.current_participants ?? 0)} / {s.max_participants ?? 0} participants
                        {participants.length > 0 && ` · ${participants.join(', ')}`}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {isOwner(s) && (
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
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Box 2: Open partner sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Open partner sessions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Someone is looking for a partner. Request to join; the session owner approves.
            </p>
          </CardHeader>
          <CardContent>
            {partnerList.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No open partner sessions right now.</p>
                <Button asChild variant="outline">
                  <Link href="/partner-sessions">View partner sessions page</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {partnerList.map((s) => {
                  const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
                  const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
                  const ywRel = s.session_participants?.[0]?.youth_wrestlers;
                  const yw = Array.isArray(ywRel) ? ywRel[0] : ywRel;
                  const withWho = yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ') : null;
                  const dt = new Date(s.scheduled_datetime);
                  const isOwn = s.parent_id === user.id || s.athlete_id === user.id;

                  return (
                    <div key={s.id} className="p-3 border rounded-lg space-y-2">
                      <p className="font-medium text-sm">
                        {format(dt, 'EEEE, MMM d')} at {format(dt, 'h:mm a')}
                        {isOwn && (
                          <span className="ml-2 text-xs font-normal text-accent bg-accent/20 px-2 py-0.5 rounded">You own</span>
                        )}
                      </p>
                      <p className="text-sm flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {coach ? `${(coach as { first_name?: string; last_name?: string }).first_name ?? ''} ${(coach as { first_name?: string; last_name?: string }).last_name ?? ''}`.trim() : '—'}
                        {coach?.school && <SchoolLogo school={(coach as { school?: string }).school ?? ''} size="sm" />}
                      </p>
                      {withWho && (
                        <p className="text-xs text-muted-foreground">Looking for partner · with {withWho}</p>
                      )}
                      {fac && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {(fac as { name?: string }).name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        ${Number(s.price_per_participant ?? s.total_price ?? 0).toFixed(2)} per person
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {isOwn && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/sessions/${s.id}/requests`}>Manage join requests</Link>
                          </Button>
                        )}
                        {!isOwn && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/sessions/${s.id}/request-join`}>Request to join</Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/workspaces/from-session/${s.id}`}>Workspace</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
