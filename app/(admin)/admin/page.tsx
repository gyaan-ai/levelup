import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/** Always show latest sessions after creating/editing (avoid cached RSC missing new rows). */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import {
  AdminDashboardClient,
  type AdminSession,
  type AdminUser,
  type BillingSummary,
  type AthleteReport,
  type CoachPayout,
  type CreditRecord,
  type YouthSessionSpendLine,
} from './admin-dashboard-client';
import { coachPayoutUsd } from '@/lib/coach-session-payout';

function roundRatingAvg(sum: number, count: number): number {
  return Math.round((sum / count) * 100) / 100;
}

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

export default async function AdminPage() {
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

  if (userData?.role !== 'admin') {
    const adminEmails = getAdminEmails();
    const emailLower = (user.email ?? '').toLowerCase();
    if (adminEmails.has(emailLower)) {
      try {
        const admin = createAdminClient(tenant.slug);
        const { error } = await admin
          .from('users')
          .update({ role: 'admin' })
          .eq('id', user.id);
        if (!error) redirect('/admin');
      } catch {
        /* ignore */
      }
    }
    if (userData?.role === 'parent') redirect('/browse');
    if (userData?.role === 'coach') redirect('/athlete-dashboard');
    redirect('/');
  }

  const admin = createAdminClient(tenant.slug);

  const [sessionsRes, usersRes, creditsRes, athletesRes, reviewsRes] = await Promise.all([
    admin
      .from('sessions')
      .select(`
        id,
        parent_id,
        athlete_id,
        scheduled_datetime,
        status,
        duration_minutes,
        total_price,
        athlete_payment,
        athlete_payout_date,
        org_fee,
        stripe_fee,
        session_type,
        session_mode,
        join_policy,
        focus_area,
        focus_area_2,
        partner_invite_code,
        current_participants,
        max_participants,
        price_per_participant,
        session_payout_rate,
        athletes(id, first_name, last_name, school, venmo_handle, zelle_email, payout_rate),
        facilities(id, name),
        session_participants(id, amount_paid, youth_wrestler_id, stripe_fee)
      `)
      .order('scheduled_datetime', { ascending: false })
      .limit(10000),
    admin
      .from('users')
      .select('id, email, role, created_at, last_login_at, first_name, last_name')
      .order('created_at', { ascending: false }),
    admin
      .from('credits')
      .select('id, parent_id, amount, remaining, source, description, created_at, expires_at')
      .order('created_at', { ascending: false }),
    admin
      .from('athletes')
      .select('id, first_name, last_name, school, average_rating, review_count, active')
      .order('last_name'),
    admin.from('reviews').select('athlete_id, rating'),
  ]);

  if (usersRes.error) {
    console.error('Admin users fetch error:', usersRes.error);
  }
  const usersRows = (usersRes.data ?? []).map((u) => {
    const row = u as {
      id: string;
      email: string;
      role: string;
      created_at: string;
      last_login_at?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    };
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      created_at: row.created_at,
      last_login_at: row.last_login_at ?? null,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
    };
  });
  if (sessionsRes.error) {
    console.error('Admin sessions fetch error:', sessionsRes.error);
    console.error('Admin sessions error details:', JSON.stringify(sessionsRes.error, null, 2));
  }
  if (creditsRes.error) {
    console.error('Admin credits fetch error:', creditsRes.error);
  }
  if (athletesRes.error) {
    console.error('Admin athletes fetch error:', athletesRes.error);
  }
  if (reviewsRes.error) {
    console.error('Admin reviews fetch error:', reviewsRes.error);
  }

  const reviewAggByAthlete = new Map<string, { sum: number; count: number }>();
  for (const row of reviewsRes.data ?? []) {
    const r = row as { athlete_id?: string; rating?: number };
    const id = r.athlete_id;
    if (!id) continue;
    const rating = Number(r.rating);
    if (!Number.isFinite(rating)) continue;
    const prev = reviewAggByAthlete.get(id) ?? { sum: 0, count: 0 };
    prev.sum += rating;
    prev.count += 1;
    reviewAggByAthlete.set(id, prev);
  }

  

  const sessionsRows = (sessionsRes.data ?? []) as Array<{
    id: string;
    parent_id: string;
    athlete_id?: string;
    scheduled_datetime: string;
    status: string;
    total_price: number;
    athlete_payment: number;
    athlete_payout_date?: string | null;
    org_fee: number;
    stripe_fee: number;
    session_type?: string;
    session_mode?: string;
    partner_invite_code?: string | null;
    current_participants?: number | null;
    max_participants?: number | null;
    price_per_participant?: number | null;
    athletes?: { id: string; first_name: string; last_name: string; school: string; venmo_handle?: string | null; zelle_email?: string | null } | { id: string; first_name: string; last_name: string; school: string; venmo_handle?: string | null; zelle_email?: string | null }[];
    facilities?: { id: string; name: string } | { id: string; name: string }[];
    session_participants?: Array<{
      id?: string;
      amount_paid?: number | null;
      youth_wrestler_id?: string | null;
      stripe_fee?: number | null;
    }> | {
      id?: string;
      amount_paid?: number | null;
      youth_wrestler_id?: string | null;
      stripe_fee?: number | null;
    };
  }>;

  const emailByUserId = new Map(usersRows.map((u) => [u.id, u.email]));

  type ParticipantRow = { 
    id?: string;
    amount_paid?: number | null; 
    youth_wrestler_id?: string | null; 
    stripe_fee?: number | null;
  };
  
  function participantAmountPaidSum(s: (typeof sessionsRows)[0]): number {
    const raw = s.session_participants;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return rows.reduce((sum, p) => sum + Number((p as ParticipantRow).amount_paid ?? 0), 0);
  }
  
  // Calculate drop-in amount (participants with null youth_wrestler_id)
  function dropInAmount(s: (typeof sessionsRows)[0]): number {
    const raw = s.session_participants;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return rows
      .filter((p) => (p as ParticipantRow).youth_wrestler_id === null)
      .reduce((sum, p) => sum + Number((p as ParticipantRow).amount_paid ?? 0), 0);
  }
  
  function dropInCount(s: (typeof sessionsRows)[0]): number {
    const raw = s.session_participants;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return rows.filter((p) => (p as ParticipantRow).youth_wrestler_id === null).length;
  }
  
  // Sum of actual Stripe fees from session_participants
  function stripeFeeSum(s: (typeof sessionsRows)[0]): number {
    const raw = s.session_participants;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return rows.reduce((sum, p) => sum + Number((p as ParticipantRow).stripe_fee ?? 0), 0);
  }
  
  // Count actual participants from session_participants table (not stale counter)
  function actualParticipantCount(s: (typeof sessionsRows)[0]): number {
    const raw = s.session_participants;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return rows.length;
  }

  const youthSessionSpendLines: YouthSessionSpendLine[] = [];
  for (const s of sessionsRows) {
    const a = s.athletes;
    const coach = Array.isArray(a) ? a[0] : a;
    const coachName = coach ? `${coach.first_name} ${coach.last_name}`.trim() : '—';
    const f = s.facilities;
    const fo = Array.isArray(f) ? f[0] : f;
    const facilityName = fo?.name ?? '—';
    const raw = s.session_participants;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const p of rows) {
      const pr = p as ParticipantRow;
      const yid = pr.youth_wrestler_id;
      if (yid == null || yid === '') continue;
      const amt = Math.round(Number(pr.amount_paid ?? 0) * 100) / 100;
      youthSessionSpendLines.push({
        youth_wrestler_id: yid,
        session_id: s.id,
        amount_paid: amt,
        scheduled_datetime: s.scheduled_datetime,
        session_status: s.status,
        session_type: s.session_type ?? undefined,
        coach_name: coachName,
        facility_name: facilityName,
      });
    }
  }
  youthSessionSpendLines.sort((a, b) => b.scheduled_datetime.localeCompare(a.scheduled_datetime));

  const sessions: AdminSession[] = sessionsRows.map((s) => {
    const a = s.athletes;
    const o = Array.isArray(a) ? a[0] : a;
    const f = s.facilities;
    const fo = Array.isArray(f) ? f[0] : f;
    // Cast to access fields not in generated types
    const row = s as typeof s & { duration_minutes?: number; price_per_participant?: number; join_policy?: string; focus_area?: string; focus_area_2?: string };
    return {
      id: s.id,
      athlete_id: s.athlete_id ?? '',
      scheduled_datetime: s.scheduled_datetime,
      status: s.status,
      duration_minutes: row.duration_minutes ?? 60,
      total_price: Number(s.total_price ?? 0),
      athlete_payment: Number(s.athlete_payment ?? 0),
      org_fee: Number(s.org_fee ?? 0),
      stripe_fee: Number(s.stripe_fee ?? 0),
      session_type: s.session_type ?? undefined,
      session_mode: s.session_mode ?? undefined,
      join_policy: row.join_policy ?? 'public',
      focus_area: row.focus_area ?? null,
      focus_area_2: row.focus_area_2 ?? null,
      partner_invite_code: s.partner_invite_code ?? null,
      current_participants: actualParticipantCount(s),
      max_participants: s.max_participants ?? 1,
      price_per_participant: row.price_per_participant ?? 30,
      parent_id: s.parent_id,
      parent_email: emailByUserId.get(s.parent_id) ?? '—',
      athlete_name: o ? `${o.first_name} ${o.last_name}` : '—',
      athlete_school: o?.school ?? '—',
      facility_id: fo?.id ?? '',
      facility_name: fo?.name ?? '—',
      participant_amount_paid_sum: participantAmountPaidSum(s),
      drop_in_amount: dropInAmount(s),
      drop_in_count: dropInCount(s),
      stripe_fee_sum: stripeFeeSum(s),
      athlete_payout_date: s.athlete_payout_date ?? null,
      session_payout_rate:
        (s as { session_payout_rate?: number | null }).session_payout_rate ?? null,
      coach_payout_rate:
        o && (o as { payout_rate?: number | null }).payout_rate != null
          ? Number((o as { payout_rate?: number | null }).payout_rate)
          : null,
    };
  });

  const users: AdminUser[] = usersRows.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    last_login_at: u.last_login_at ?? null,
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
  }));

  const billing: BillingSummary = {
    totalRevenue: sessions.reduce((sum, s) => sum + s.total_price, 0),
    totalOrgFees: sessions.reduce((sum, s) => sum + s.org_fee, 0),
    totalStripeFees: sessions.reduce((sum, s) => sum + s.stripe_fee, 0),
    totalAthletePayments: sessions.reduce((sum, s) => sum + s.athlete_payment, 0),
    upcomingOpenRevenue: sessions.filter((s) => ['scheduled', 'pending_payment'].includes(s.status) && new Date(s.scheduled_datetime) >= new Date()).reduce((sum, s) => sum + s.total_price, 0),
    upcomingOpenOrgFees: sessions.filter((s) => ['scheduled', 'pending_payment'].includes(s.status) && new Date(s.scheduled_datetime) >= new Date()).reduce((sum, s) => sum + s.org_fee, 0),
    upcomingOpenStripeFees: sessions.filter((s) => ['scheduled', 'pending_payment'].includes(s.status) && new Date(s.scheduled_datetime) >= new Date()).reduce((sum, s) => sum + s.stripe_fee, 0),
    upcomingOpenAthletePayments: sessions.filter((s) => ['scheduled', 'pending_payment'].includes(s.status) && new Date(s.scheduled_datetime) >= new Date()).reduce((sum, s) => sum + s.athlete_payment, 0),
    sessionCount: sessions.length,
    completedCount: sessions.filter((s) => s.status === 'completed').length,
    pendingPaymentCount: sessions.filter((s) => s.status === 'pending_payment').length,
    upcomingOpenCount: sessions.filter((s) => ['scheduled', 'pending_payment'].includes(s.status) && new Date(s.scheduled_datetime) >= new Date()).length,
  };

  // Build coach list from all athletes so coaches with no sessions (e.g. Cam) still appear
  const athletesRows = (athletesRes.data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    school: string | null;
    average_rating?: number | null;
    review_count?: number | null;
    active?: boolean | null;
  }>;
  const athleteMap = new Map<string, AthleteReport>();
  for (const o of athletesRows) {
    const agg = reviewAggByAthlete.get(o.id);
    const fromReviews =
      agg && agg.count > 0
        ? {
            average_rating: roundRatingAvg(agg.sum, agg.count),
            review_count: agg.count,
          }
        : null;
    athleteMap.set(o.id, {
      athlete_id: o.id,
      athlete_name: `${o.first_name} ${o.last_name}`.trim() || '—',
      school: o.school ?? '',
      session_count: 0,
      total_earnings: 0,
      completed_count: 0,
      average_rating: fromReviews
        ? fromReviews.average_rating
        : o.average_rating != null
          ? Number(o.average_rating)
          : null,
      review_count: fromReviews
        ? fromReviews.review_count
        : o.review_count != null
          ? Number(o.review_count)
          : 0,
      active: o.active ?? false,
    });
  }
  for (const s of sessionsRows) {
    const a = s.athletes;
    const o = Array.isArray(a) ? a[0] : a;
    if (!o?.id) continue;
    const r = athleteMap.get(o.id);
    if (r) {
      r.session_count += 1;
      r.total_earnings += coachPayoutUsd({
        athlete_payment: s.athlete_payment,
        price_per_participant: s.price_per_participant,
        current_participants: s.current_participants,
        participant_amount_paid_sum: participantAmountPaidSum(s),
        session_payout_rate: (s as { session_payout_rate?: number | null }).session_payout_rate ?? null,
        coach_payout_rate:
          o && (o as { payout_rate?: number | null }).payout_rate != null
            ? Number((o as { payout_rate?: number | null }).payout_rate)
            : null,
      });
      if (s.status === 'completed') r.completed_count += 1;
    }
  }
  const athleteReports = Array.from(athleteMap.values()).sort(
    (a, b) => b.total_earnings - a.total_earnings || a.athlete_name.localeCompare(b.athlete_name)
  );

  // Coach payouts: completed sessions not yet paid (athlete_payout_date IS NULL)
  const payoutOwedByAthlete = new Map<string, { amount: number; venmo_handle?: string | null; zelle_email?: string | null; name: string; school: string }>();
  for (const s of sessionsRows) {
    if (s.status !== 'completed' || s.athlete_payout_date != null) continue;
    const a = s.athletes;
    const o = Array.isArray(a) ? a[0] : a;
    if (!o?.id) continue;
    const existing = payoutOwedByAthlete.get(o.id);
    const payment = coachPayoutUsd({
      athlete_payment: s.athlete_payment,
      price_per_participant: s.price_per_participant,
      current_participants: s.current_participants,
      participant_amount_paid_sum: participantAmountPaidSum(s),
      session_payout_rate: (s as { session_payout_rate?: number | null }).session_payout_rate ?? null,
      coach_payout_rate:
        o && (o as { payout_rate?: number | null }).payout_rate != null
          ? Number((o as { payout_rate?: number | null }).payout_rate)
          : null,
    });
    if (existing) {
      existing.amount += payment;
    } else {
      payoutOwedByAthlete.set(o.id, {
        amount: payment,
        venmo_handle: o.venmo_handle ?? null,
        zelle_email: o.zelle_email ?? null,
        name: `${o.first_name} ${o.last_name}`,
        school: o.school ?? '',
      });
    }
  }
  const coachPayouts = Array.from(payoutOwedByAthlete.entries())
    .map(([athlete_id, data]) => ({ athlete_id, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // Credits with parent email
  const credits: CreditRecord[] = (creditsRes.data ?? []).map((c) => ({
    id: c.id,
    parent_id: c.parent_id,
    parent_email: emailByUserId.get(c.parent_id) ?? '—',
    amount: Number(c.amount),
    remaining: Number(c.remaining),
    source: c.source,
    description: c.description,
    created_at: c.created_at,
    expires_at: c.expires_at,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground">Admin</h1>
        <p className="text-muted-foreground mt-1">
          Cockpit · Sessions · Users · Billing · Payouts · Coaches
        </p>
      </div>
      <AdminDashboardClient
        sessions={sessions}
        users={users}
        billing={billing}
        athleteReports={athleteReports}
        coachPayouts={coachPayouts}
        credits={credits}
        usersError={usersRes.error?.message ?? null}
        youthSessionSpendLines={youthSessionSpendLines}
      />
    </div>
  );
}
