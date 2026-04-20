import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { coachPayoutUsd } from '@/lib/coach-session-payout';

export const dynamic = 'force-dynamic';

/** RecruitNC (or other integrations) send this header; Guild validates it. */
const GUILD_API_SECRET = process.env.GUILD_API_SECRET ?? '';

type Period = 'today' | 'this_week' | 'this_month' | 'this_year';

function getPeriodWindow(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const tod = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  switch (period) {
    case 'today':
      return { start: tod(now), end: now };
    case 'this_week': {
      const day = now.getUTCDay();
      const monday = tod(now);
      monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7));
      return { start: monday, end: now };
    }
    case 'this_month':
      return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: now };
    case 'this_year':
      return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end: now };
  }
}

type SessionParticipantRow = { amount_paid?: number | null };
type SessionStatsRow = {
  id: string;
  session_type?: string | null;
  status?: string | null;
  athlete_payment?: number | null;
  price_per_participant?: number | null;
  current_participants?: number | null;
  session_payout_rate?: number | null;
  session_participants?: SessionParticipantRow[] | null;
};

function sessionRevenue(s: SessionStatsRow): number {
  return (s.session_participants ?? []).reduce(
    (sum, p) => sum + Number(p.amount_paid ?? 0),
    0
  );
}

function sessionCoachPayout(s: SessionStatsRow): number {
  const participant_amount_paid_sum = sessionRevenue(s);
  return coachPayoutUsd({
    athlete_payment: s.athlete_payment,
    price_per_participant: s.price_per_participant,
    current_participants: s.current_participants,
    participant_amount_paid_sum,
    session_payout_rate: s.session_payout_rate ?? null,
  });
}

export async function GET(request: Request) {
  const secret = request.headers.get('x-guild-api-secret') ?? '';
  if (!GUILD_API_SECRET || secret !== GUILD_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get('period') ?? 'this_week') as Period;
  const { start, end } = getPeriodWindow(period);

  const supabase = createAdminClient('guild');

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id,
      session_type,
      status,
      athlete_payment,
      price_per_participant,
      current_participants,
      session_payout_rate,
      session_participants (
        amount_paid
      )
    `)
    .eq('status', 'completed')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (error) {
    console.error('[guild/stats]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (sessions ?? []) as SessionStatsRow[];
  const SESSION_TYPES = ['1-on-1', '2-athlete', 'group'] as const;

  const bySessionType = Object.fromEntries(
    SESSION_TYPES.map((type) => {
      const matching = rows.filter((s) => s.session_type === type);
      return [
        type,
        {
          count: matching.length,
          revenue: matching.reduce((sum, s) => sum + sessionRevenue(s), 0),
        },
      ];
    })
  );

  const totalRevenue = rows.reduce((sum, s) => sum + sessionRevenue(s), 0);
  const totalCoachPayout = rows.reduce((sum, s) => sum + sessionCoachPayout(s), 0);
  const platformFee = totalRevenue - totalCoachPayout;

  return NextResponse.json({
    period,
    bookingCount: rows.length,
    bookingRevenue: totalRevenue,
    coachPayout: totalCoachPayout,
    platformFee,
    bySessionType,
    dataAvailable: true,
  });
}
