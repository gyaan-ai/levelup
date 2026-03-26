import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Calendar, Clock } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { coachPayoutUsd } from '@/lib/coach-session-payout';

export const dynamic = 'force-dynamic';

export default async function CoachEarningsPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'coach' && userData?.role !== 'admin') {
    redirect('/login');
  }

  // Get coach's payout rate (defaults to 83.33% if not set)
  const { data: athlete } = await supabase
    .from('athletes')
    .select('first_name, payout_rate')
    .eq('id', user.id)
    .maybeSingle();

  const payoutRate = athlete?.payout_rate ?? 0.8333;

  // This month
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  // Last month
  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setMilliseconds(-1);

  // Use admin client to bypass RLS
  const admin = createAdminClient(tenant.slug);

  // All time completed sessions with earnings
  const { data: completedSessions } = await admin
    .from('sessions')
    .select(`
      id, 
      scheduled_datetime, 
      completed_at, 
      athlete_payment, 
      total_price, 
      session_type, 
      current_participants,
      price_per_participant,
      session_participants(id, amount_paid)
    `)
    .eq('athlete_id', user.id)
    .in('status', ['completed', 'scheduled', 'pending_payment'])
    .not('scheduled_datetime', 'is', null)
    .lt('scheduled_datetime', new Date().toISOString())
    .order('scheduled_datetime', { ascending: false });

  // Helper to calculate session payout using coachPayoutUsd
  const getSessionPayout = (s: typeof completedSessions extends (infer T)[] | null ? T : never) => {
    const participantAmountPaidSum = Array.isArray(s.session_participants)
      ? s.session_participants.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
      : 0;
    return coachPayoutUsd({
      athlete_payment: s.athlete_payment,
      price_per_participant: s.price_per_participant,
      current_participants: s.current_participants,
      participant_amount_paid_sum: participantAmountPaidSum > 0 ? participantAmountPaidSum : null,
    }, Number(payoutRate));
  };

  // Filter sessions by date (use scheduled_datetime since completed_at might not be set)
  const thisMonthSessions = (completedSessions ?? []).filter(
    (s) => new Date(s.scheduled_datetime) >= thisMonthStart
  );
  const lastMonthSessions = (completedSessions ?? []).filter(
    (s) => new Date(s.scheduled_datetime) >= lastMonthStart && new Date(s.scheduled_datetime) <= lastMonthEnd
  );

  const thisMonthEarnings = thisMonthSessions.reduce((sum, s) => sum + getSessionPayout(s), 0);
  const lastMonthEarnings = lastMonthSessions.reduce((sum, s) => sum + getSessionPayout(s), 0);
  const allTimeEarnings = (completedSessions ?? []).reduce((sum, s) => sum + getSessionPayout(s), 0);
  const totalSessions = completedSessions?.length ?? 0;

  // Upcoming sessions with projected earnings
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('id, scheduled_datetime, total_price, session_type, current_participants, max_participants, session_payout_rate')
    .eq('athlete_id', user.id)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', new Date().toISOString())
    .order('scheduled_datetime', { ascending: true })
    .limit(10);

  // Calculate projected earnings for upcoming sessions
  const projectedEarnings = (upcomingSessions ?? []).reduce((sum, s) => {
    const rate = s.session_payout_rate ?? payoutRate;
    const totalPrice = Number(s.total_price || 0);
    return sum + (totalPrice * Number(rate));
  }, 0);

  return (
    <div className="container mx-auto px-4 py-5 pb-24 md:py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Your rate</p>
          <p className="font-semibold text-foreground">
            {Math.round(payoutRate * 100)}%
            {payoutRate >= 0.9 && (
              <span className="ml-1 text-xs text-[#D4AF37] font-medium">(Founding Coach)</span>
            )}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">This Month</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${thisMonthEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">{thisMonthSessions.length} session{thisMonthSessions.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">All Time</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${allTimeEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">{totalSessions} session{totalSessions !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Projected earnings */}
      {projectedEarnings > 0 && (
        <Card className="mb-6 border-[#D4AF37]/30 bg-[#D4AF37]/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Projected from upcoming sessions</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${projectedEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">{upcomingSessions?.length ?? 0} upcoming session{(upcomingSessions?.length ?? 0) !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      )}

      {/* Payout rate info */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Your payout rate: <span className="font-medium text-foreground">{(Number(payoutRate) * 100).toFixed(0)}%</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You earn {(Number(payoutRate) * 100).toFixed(0)}% of each session&apos;s total price after payment processing.
          </p>
        </CardContent>
      </Card>

      {/* Recent completed sessions */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recent Sessions</h2>
        {(completedSessions ?? []).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No completed sessions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(completedSessions ?? []).slice(0, 10).map((session) => (
              <Card key={session.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatEST(new Date(session.scheduled_datetime), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {session.session_type?.replace('_', ' ') ?? 'Session'} · {session.current_participants ?? 1} athlete{(session.current_participants ?? 1) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-emerald-500">
                    +${getSessionPayout(session).toFixed(0)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
