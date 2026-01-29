import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { isProfileComplete } from '@/lib/athletes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Calendar, DollarSign, TrendingUp, Clock, Trophy, Users, MessageCircle } from 'lucide-react';

export default async function AthleteDashboard() {
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

  if (userData?.role !== 'athlete') {
    if (userData?.role === 'parent') {
      redirect('/browse');
    } else if (userData?.role === 'admin') {
      redirect('/admin');
    }
  }

  // Get athlete profile
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // If no athlete record exists, redirect to onboarding
  if (!athlete) {
    redirect('/onboarding');
  }

  // Check if profile is complete (only requires bio now, photo is optional)
  if (!isProfileComplete(athlete)) {
    redirect('/onboarding');
  }

  // Get earnings data
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const { data: thisMonthSessions } = await supabase
    .from('sessions')
    .select('athlete_payment')
    .eq('athlete_id', user.id)
    .eq('status', 'completed')
    .gte('completed_at', thisMonth.toISOString());

  const thisMonthEarnings = thisMonthSessions?.reduce((sum, s) => sum + Number(s.athlete_payment || 0), 0) || 0;

  // Get pending earnings
  const { data: pendingSessions } = await supabase
    .from('sessions')
    .select('athlete_payment')
    .eq('athlete_id', user.id)
    .eq('status', 'completed')
    .eq('athlete_paid', false);

  const pendingEarnings = pendingSessions?.reduce((sum, s) => sum + Number(s.athlete_payment || 0), 0) || 0;

  // Upcoming: scheduled + pending_payment, future only
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('*, facilities(name)')
    .eq('athlete_id', user.id)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', new Date().toISOString())
    .order('scheduled_datetime', { ascending: true })
    .limit(20);

  // Past: completed, cancelled, no-show, or already passed
  const { data: pastSessions } = await supabase
    .from('sessions')
    .select('*, facilities(name)')
    .eq('athlete_id', user.id)
    .in('status', ['completed', 'cancelled', 'no-show'])
    .order('scheduled_datetime', { ascending: false })
    .limit(15);

  // Coach ranking (admin client to read all athletes)
  type LeaderboardRow = { id: string; total_sessions: number; ytd_earnings: number };
  let rankBySessions: number | null = null;
  let rankByEarnings: number | null = null;
  let totalCoaches = 0;
  try {
    const admin = createAdminClient(tenantSlug);
    const { data: allAthletes } = await admin
      .from('athletes')
      .select('id, total_sessions, ytd_earnings');
    const list = (allAthletes || []) as LeaderboardRow[];
    totalCoaches = list.length;
    const bySessions = [...list].sort((a, b) => (b.total_sessions || 0) - (a.total_sessions || 0));
    const byEarnings = [...list].sort((a, b) => (b.ytd_earnings || 0) - (a.ytd_earnings || 0));
    const sIdx = bySessions.findIndex((r) => r.id === user.id);
    const eIdx = byEarnings.findIndex((r) => r.id === user.id);
    if (sIdx >= 0) rankBySessions = sIdx + 1;
    if (eIdx >= 0) rankByEarnings = eIdx + 1;
  } catch {
    /* ranking optional */
  }

  // Calculate commitment progress
  const commitmentProgress = athlete
    ? Math.min((athlete.commitment_sessions / (athlete.commitment_sessions || 1)) * 100, 100)
    : 0;

  const facilityName = (s: { facilities?: unknown }) => {
    const f = s.facilities;
    if (!f || typeof f !== 'object') return '—';
    const arr = Array.isArray(f) ? f : [f];
    const first = arr[0] as { name?: string } | null;
    return first?.name ?? '—';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-primary">Crew Coach Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, Coach{athlete?.first_name ? ` ${athlete.first_name}` : ''}! Manage your profile, view earnings, and track your sessions.
        </p>
      </div>

      {/* Earnings + Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${thisMonthEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(athlete?.ytd_earnings || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting payout</p>
          </CardContent>
        </Card>

        {/* Coach ranking */}
        {(rankBySessions != null || rankByEarnings != null) && totalCoaches > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Ranking</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {rankBySessions != null && (
                <p className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">#{rankBySessions}</span> of {totalCoaches} by sessions
                </p>
              )}
              {rankByEarnings != null && (
                <p className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">#{rankByEarnings}</span> of {totalCoaches} by earnings
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Commitment Progress */}
      {athlete && athlete.commitment_sessions > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Crew Commitment</CardTitle>
            <CardDescription>
              {athlete.commitment_sessions} sessions completed
              {athlete.commitment_deadline && (
                <> • Complete by {new Date(athlete.commitment_deadline).toLocaleDateString()}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={commitmentProgress} className="mb-2" />
            <p className="text-sm text-muted-foreground">
              {athlete.commitment_fulfilled ? '✅ Commitment fulfilled!' : 'Keep going!'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule: Upcoming */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Schedule & Bookings</CardTitle>
          <CardDescription>Upcoming and past sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Upcoming</h3>
            {upcomingSessions && upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {upcomingSessions.map((session: { id: string; scheduled_datetime: string; facilities?: unknown; total_price?: number; session_type?: string; status?: string }) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(session.scheduled_datetime).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
                        {new Date(session.scheduled_datetime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' • '}
                        {facilityName(session)}
                        {session.status === 'pending_payment' && (
                          <>
                            <span> • </span>
                            <Badge variant="secondary" className="text-xs">Pending payment</Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="font-medium">${Number(session.total_price || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{session.session_type || '—'}</p>
                      <Link href={`/messages/${session.id}`}>
                        <Button variant="ghost" size="sm">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border rounded-lg bg-muted/30">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No upcoming sessions</p>
              </div>
            )}
          </div>

          {/* Past */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Past</h3>
            {pastSessions && pastSessions.length > 0 ? (
              <div className="space-y-3">
                {pastSessions.map((session: { id: string; scheduled_datetime: string; facilities?: unknown; total_price?: number; session_type?: string; status?: string }) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-muted/20"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(session.scheduled_datetime).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
                        {new Date(session.scheduled_datetime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' • '}
                        {facilityName(session)}
                        {' • '}
                        <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                          {session.status === 'completed' ? 'Completed' : session.status === 'cancelled' ? 'Cancelled' : 'No-show'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="font-medium">${Number(session.total_price || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{session.session_type || '—'}</p>
                      <Link href={`/messages/${session.id}`}>
                        <Button variant="ghost" size="sm">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No past sessions yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/availability">
          <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
            <Calendar className="h-6 w-6 mb-2" />
            Set Availability
          </Button>
        </Link>
        <Link href="/profile">
          <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
            <span className="text-2xl mb-2">👤</span>
            View Profile
          </Button>
        </Link>
      </div>
    </div>
  );
}
