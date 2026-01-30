import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Edit, User, Calendar } from 'lucide-react';
import { YouthWrestler } from '@/types';

export default async function ParentDashboard() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    redirect('/404');
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role === 'athlete') {
    redirect('/athlete-dashboard');
  }
  // parent and admin can both access dashboard (admin can switch to product view)

  // Get youth wrestlers
  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false });

  const youthWrestlerIds = youthWrestlers?.map((yw) => yw.id) || [];

  const { data: completedSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('parent_id', user.id)
    .eq('status', 'completed');
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

  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('*, athletes(id, first_name, last_name), facilities(id, name)')
    .eq('parent_id', user.id)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', new Date().toISOString())
    .order('scheduled_datetime', { ascending: true })
    .limit(10);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold mb-2 text-primary">Your Wrestlers</h1>
          <p className="text-muted-foreground">
            Manage profiles and book sessions with elite coaches
          </p>
        </div>
        {youthWrestlers && youthWrestlers.length > 0 && (
          <Link href="/wrestlers/add">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Another Wrestler
            </Button>
          </Link>
        )}
      </div>

      {youthWrestlers && youthWrestlers.length > 0 ? (
        <>
          {/* Youth Wrestler Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {youthWrestlers.map((wrestler: YouthWrestler) => {
              const sessionsCompleted = sessionCounts[wrestler.id] || 0;
              
              return (
                <Card key={wrestler.id} className="overflow-hidden">
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/40">
                    {wrestler.photo_url ? (
                      <img
                        src={wrestler.photo_url}
                        alt={`${wrestler.first_name} ${wrestler.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <User className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {wrestler.first_name} {wrestler.last_name}
                    </CardTitle>
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
                      <Link href={`/browse?youthWrestlerId=${wrestler.id}`} className="flex-1">
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

          {/* Upcoming Sessions */}
          {upcomingSessions && upcomingSessions.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Upcoming Sessions</CardTitle>
                  <CardDescription>
                    Sessions you&apos;ve booked
                  </CardDescription>
                </div>
                <Link href="/bookings">
                  <Button variant="outline" size="sm">View all</Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingSessions.map((session: { id: string; scheduled_datetime: string; total_price?: number; session_type?: string; athletes?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[]; facilities?: { name?: string } | { name?: string }[] }) => {
                    const a = session.athletes;
                    const coach = Array.isArray(a) ? a[0] : a;
                    const f = session.facilities;
                    const fac = Array.isArray(f) ? f[0] : f;
                    return (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {coach?.first_name} {coach?.last_name}
                            {fac?.name && ` · ${fac.name}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(session.scheduled_datetime).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                            {' · '}
                            {new Date(session.scheduled_datetime).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${Number(session.total_price ?? 0).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{session.session_type ?? '—'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
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
                  <Link href="/bookings">
                    <Button variant="outline">View bookings</Button>
                  </Link>
                  <Link href="/browse">
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
              Create a profile for your youth wrestler to start training with elite NCAA wrestlers.
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
    </div>
  );
}
