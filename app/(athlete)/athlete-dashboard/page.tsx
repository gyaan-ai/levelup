import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { isProfileComplete } from '@/lib/athletes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { Calendar, DollarSign, TrendingUp, Clock } from 'lucide-react';

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

  // Get upcoming sessions
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('*, facilities(name)')
    .eq('athlete_id', user.id)
    .eq('status', 'scheduled')
    .gte('scheduled_datetime', new Date().toISOString())
    .order('scheduled_datetime', { ascending: true })
    .limit(5);

  // Calculate commitment progress
  const commitmentProgress = athlete
    ? Math.min((athlete.commitment_sessions / (athlete.commitment_sessions || 1)) * 100, 100)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Athlete Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome{athlete?.first_name ? `, ${athlete.first_name}` : ''}! Manage your profile, view earnings, and track your sessions.
        </p>
      </div>

      {/* Earnings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting payout
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commitment Progress */}
      {athlete && athlete.commitment_sessions > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Commitment Progress</CardTitle>
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

      {/* Upcoming Sessions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Upcoming Sessions</CardTitle>
          <CardDescription>Your next scheduled sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingSessions && upcomingSessions.length > 0 ? (
            <div className="space-y-4">
              {upcomingSessions.map((session: any) => (
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
                    <p className="text-sm text-muted-foreground">
                      {new Date(session.scheduled_datetime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' • '}
                      {session.facilities?.name || 'Facility'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(session.total_price).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{session.session_type}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No sessions scheduled</p>
            </div>
          )}
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
