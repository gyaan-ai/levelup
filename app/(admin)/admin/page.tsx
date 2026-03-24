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
} from './admin-dashboard-client';
import { coachPayoutUsd } from '@/lib/coach-session-payout';

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

  const [sessionsRes, usersRes, creditsRes, athletesRes] = await Promise.all([
    admin
      .from('sessions')
      .select(`
        id,
        parent_id,
        athlete_id,
        scheduled_datetime,
        status,
        total_price,
        athlete_payment,
        athlete_payout_date,
        org_fee,
        stripe_fee,
        session_type,
        session_mode,
        partner_invite_code,
        current_participants,
        max_participants,
        price_per_participant,
        athletes(id, first_name, last_name, school, venmo_handle, zelle_email),
        facilities(id, name),
        session_participants(amount_paid)
      `)
      .order('scheduled_datetime', { ascending: false })
      .limit(10000),
    admin
      .from('users')
      .select('id, email, role, created_at, last_login_at')
      .order('created_at', { ascending: false }),
    admin
      .from('credits')
      .select('id, parent_id, amount, remaining, source, description, created_at, expires_at')
      .order('created_at', { ascending: false }),
    admin
      .from('athletes')
      .select('id, first_name, last_name, school, average_rating, review_count')
      .order('last_name'),
  ]);

  if (usersRes.error) {
    console.error('Admin users fetch error:', usersRes.error);
  }
  // If users fetch failed due to missing last_login_at column, refetch without it (migration 20240111000000 not run)
  let usersRows = (usersRes.data ?? []) as Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    last_login_at?: string | null;
  }>;
  if (usersRes.error && usersRes.error.message?.includes('last_login_at')) {
    const { data: fallback } = await admin
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });
    usersRows = (fallback ?? []).map((u) => ({ ...u, last_login_at: null }));
  }
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
    session_participants?: { amount_paid?: number | null }[] | { amount_paid?: number | null };
  }>;

  const emailByUserId = new Map(usersRows.map((u) => [u.id, u.email]));

  function participantAmountPaidSum(s: (typeof sessionsRows)[0]): number {
    const raw = s.session_participants;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return rows.reduce((sum, p) => sum + Number((p as { amount_paid?: number | null }).amount_paid ?? 0), 0);
  }

  const sessions: AdminSession[] = sessionsRows.map((s) => {
    const a = s.athletes;
    const o = Array.isArray(a) ? a[0] : a;
    const f = s.facilities;
    const fo = Array.isArray(f) ? f[0] : f;
    return {
      id: s.id,
      athlete_id: s.athlete_id ?? '',
      scheduled_datetime: s.scheduled_datetime,
      status: s.status,
      total_price: Number(s.total_price ?? 0),
      athlete_payment: Number(s.athlete_payment ?? 0),
      org_fee: Number(s.org_fee ?? 0),
      stripe_fee: Number(s.stripe_fee ?? 0),
      session_type: s.session_type ?? undefined,
      session_mode: s.session_mode ?? undefined,
      partner_invite_code: s.partner_invite_code ?? null,
      current_participants: s.current_participants ?? 0,
      max_participants: s.max_participants ?? 1,
      parent_id: s.parent_id,
      parent_email: emailByUserId.get(s.parent_id) ?? '—',
      athlete_name: o ? `${o.first_name} ${o.last_name}` : '—',
      athlete_school: o?.school ?? '—',
      facility_name: fo?.name ?? '—',
      participant_amount_paid_sum: participantAmountPaidSum(s),
    };
  });

  const users: AdminUser[] = usersRows.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    last_login_at: u.last_login_at ?? null,
  }));

  const billing: BillingSummary = {
    totalRevenue: sessions.reduce((sum, s) => sum + s.total_price, 0),
    totalOrgFees: sessions.reduce((sum, s) => sum + s.org_fee, 0),
    totalStripeFees: sessions.reduce((sum, s) => sum + s.stripe_fee, 0),
    totalAthletePayments: sessions.reduce((sum, s) => sum + s.athlete_payment, 0),
    sessionCount: sessions.length,
    completedCount: sessions.filter((s) => s.status === 'completed').length,
    pendingPaymentCount: sessions.filter((s) => s.status === 'pending_payment').length,
  };

  // Build coach list from all athletes so coaches with no sessions (e.g. Cam) still appear
  const athletesRows = (athletesRes.data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    school: string | null;
    average_rating?: number | null;
    review_count?: number | null;
  }>;
  const athleteMap = new Map<string, AthleteReport>();
  for (const o of athletesRows) {
    athleteMap.set(o.id, {
      athlete_id: o.id,
      athlete_name: `${o.first_name} ${o.last_name}`.trim() || '—',
      school: o.school ?? '',
      session_count: 0,
      total_earnings: 0,
      completed_count: 0,
      average_rating: o.average_rating != null ? Number(o.average_rating) : null,
      review_count: o.review_count != null ? Number(o.review_count) : 0,
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
      />
    </div>
  );
}
