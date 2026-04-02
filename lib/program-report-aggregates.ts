import { coachPayoutUsd } from '@/lib/coach-session-payout';

export type ProgramReportPeriod = '7d' | '30d' | '90d' | 'ytd' | 'all';

export function programReportCutoff(period: ProgramReportPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 86400000);
    case '30d':
      return new Date(now.getTime() - 30 * 86400000);
    case '90d':
      return new Date(now.getTime() - 90 * 86400000);
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

export function sessionScheduledInPeriod(scheduledDatetime: string, cutoff: Date | null): boolean {
  if (!cutoff) return true;
  return new Date(scheduledDatetime) >= cutoff;
}

export function isProgramReportEarningsSession(
  s: { status: string | null; scheduled_datetime: string | null },
  nowIso: string
): boolean {
  const st = s.status ?? '';
  if (st === 'cancelled' || st === 'no-show') return false;
  if (st === 'completed') return true;
  const t = s.scheduled_datetime ? new Date(s.scheduled_datetime).getTime() : NaN;
  if (Number.isNaN(t)) return false;
  return t < new Date(nowIso).getTime() && (st === 'scheduled' || st === 'pending_payment');
}

export type SessionRowForProgram = {
  id: string;
  scheduled_datetime: string;
  status: string | null;
  athlete_id: string | null;
  athlete_payment: number | null;
  price_per_participant: number | null;
  current_participants: number | null;
  session_payout_rate: number | null;
  session_participants: { amount_paid?: number | null }[] | null;
  athletes:
    | {
        id: string;
        first_name?: string | null;
        last_name?: string | null;
        school?: string | null;
        payout_rate?: number | null;
      }
    | {
        id: string;
        first_name?: string | null;
        last_name?: string | null;
        school?: string | null;
        payout_rate?: number | null;
      }[]
    | null;
};

function athleteFromSession(s: SessionRowForProgram): {
  id: string;
  name: string;
  school: string;
  payout_rate: number | null;
} | null {
  const raw = s.athletes;
  const a = Array.isArray(raw) ? raw[0] : raw;
  if (!a?.id) return null;
  const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || 'Coach';
  return {
    id: a.id,
    name,
    school: (a.school ?? '').trim(),
    payout_rate: a.payout_rate != null ? Number(a.payout_rate) : null,
  };
}

export function coachMatchesSchoolFilter(coachSchool: string, filter: string): boolean {
  if (filter === '__nonaffiliated__') {
    const t = coachSchool.trim().toLowerCase();
    return (
      !coachSchool.trim() ||
      t === 'non-affiliated' ||
      t === 'independent' ||
      t === 'n/a'
    );
  }
  return coachSchool.trim() === filter.trim();
}

export type CoachProgramAgg = {
  athlete_id: string;
  coach_name: string;
  school: string;
  total_earnings: number;
  earnings_sessions: number;
  completed_sessions: number;
  average_rating: number | null;
  review_count: number;
};

export function aggregateProgramReport(
  sessions: SessionRowForProgram[],
  opts: {
    nowIso: string;
    cutoff: Date | null;
    schoolFilter: string;
    ratingByCoach: Map<string, { average_rating: number | null; review_count: number }>;
  }
): CoachProgramAgg[] {
  const { nowIso, cutoff, schoolFilter, ratingByCoach } = opts;
  const map = new Map<string, CoachProgramAgg>();

  for (const s of sessions) {
    if (!s.scheduled_datetime || !sessionScheduledInPeriod(s.scheduled_datetime, cutoff)) continue;
    if (!isProgramReportEarningsSession(s, nowIso)) continue;

    const ath = athleteFromSession(s);
    if (!ath || !s.athlete_id) continue;
    if (!coachMatchesSchoolFilter(ath.school, schoolFilter)) continue;

    const participantAmountPaidSum = Array.isArray(s.session_participants)
      ? s.session_participants.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
      : 0;
    const rate = s.session_payout_rate != null ? Number(s.session_payout_rate) : ath.payout_rate ?? 0.8333;
    const payout = coachPayoutUsd(
      {
        athlete_payment: s.athlete_payment,
        price_per_participant: s.price_per_participant,
        current_participants: s.current_participants,
        participant_amount_paid_sum: participantAmountPaidSum > 0 ? participantAmountPaidSum : null,
      },
      rate
    );

    const prev = map.get(s.athlete_id);
    const r = ratingByCoach.get(s.athlete_id);
    if (prev) {
      prev.total_earnings += payout;
      prev.earnings_sessions += 1;
      if (s.status === 'completed') prev.completed_sessions += 1;
    } else {
      map.set(s.athlete_id, {
        athlete_id: s.athlete_id,
        coach_name: ath.name,
        school: ath.school,
        total_earnings: payout,
        earnings_sessions: 1,
        completed_sessions: s.status === 'completed' ? 1 : 0,
        average_rating: r?.average_rating ?? null,
        review_count: r?.review_count ?? 0,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_earnings - a.total_earnings);
}
