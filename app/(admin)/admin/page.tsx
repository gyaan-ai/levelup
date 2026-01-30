import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
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
} from './admin-dashboard-client';

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
    if (userData?.role === 'athlete') redirect('/athlete-dashboard');
    redirect('/');
  }

  const admin = createAdminClient(tenant.slug);

  const [sessionsRes, usersRes] = await Promise.all([
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
        athletes(id, first_name, last_name, school, venmo_handle, zelle_email),
        facilities(id, name)
      `)
      .order('scheduled_datetime', { ascending: false }),
    admin
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (usersRes.error) {
    console.error('Admin users fetch error:', usersRes.error);
  }
  if (sessionsRes.error) {
    console.error('Admin sessions fetch error:', sessionsRes.error);
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
    athletes?: { id: string; first_name: string; last_name: string; school: string; venmo_handle?: string | null; zelle_email?: string | null } | { id: string; first_name: string; last_name: string; school: string; venmo_handle?: string | null; zelle_email?: string | null }[];
    facilities?: { id: string; name: string } | { id: string; name: string }[];
  }>;

  const usersRows = (usersRes.data ?? []) as Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    last_login_at?: string | null;
  }>;

  const emailByUserId = new Map(usersRows.map((u) => [u.id, u.email]));

  const sessions: AdminSession[] = sessionsRows.map((s) => {
    const a = s.athletes;
    const o = Array.isArray(a) ? a[0] : a;
    const f = s.facilities;
    const fo = Array.isArray(f) ? f[0] : f;
    return {
      id: s.id,
      scheduled_datetime: s.scheduled_datetime,
      status: s.status,
      total_price: Number(s.total_price ?? 0),
      athlete_payment: Number(s.athlete_payment ?? 0),
      org_fee: Number(s.org_fee ?? 0),
      stripe_fee: Number(s.stripe_fee ?? 0),
      session_type: s.session_type ?? undefined,
      session_mode: s.session_mode ?? undefined,
      parent_id: s.parent_id,
      parent_email: emailByUserId.get(s.parent_id) ?? '—',
      athlete_name: o ? `${o.first_name} ${o.last_name}` : '—',
      athlete_school: o?.school ?? '—',
      facility_name: fo?.name ?? '—',
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

  const athleteMap = new Map<string, AthleteReport>();
  for (const s of sessionsRows) {
    const a = s.athletes;
    const o = Array.isArray(a) ? a[0] : a;
    if (!o) continue;
    const id = o.id;
    let r = athleteMap.get(id);
    if (!r) {
      r = {
        athlete_id: id,
        athlete_name: `${o.first_name} ${o.last_name}`,
        school: o.school ?? '',
        session_count: 0,
        total_earnings: 0,
        completed_count: 0,
      };
      athleteMap.set(id, r);
    }
    r.session_count += 1;
    r.total_earnings += Number(s.athlete_payment ?? 0);
    if (s.status === 'completed') r.completed_count += 1;
  }
  const athleteReports = Array.from(athleteMap.values()).sort(
    (a, b) => b.total_earnings - a.total_earnings
  );

  // Coach payouts: completed sessions not yet paid (athlete_payout_date IS NULL)
  const payoutOwedByAthlete = new Map<string, { amount: number; venmo_handle?: string | null; zelle_email?: string | null; name: string; school: string }>();
  for (const s of sessionsRows) {
    if (s.status !== 'completed' || s.athlete_payout_date != null) continue;
    const a = s.athletes;
    const o = Array.isArray(a) ? a[0] : a;
    if (!o?.id) continue;
    const existing = payoutOwedByAthlete.get(o.id);
    const payment = Number(s.athlete_payment ?? 0);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-primary">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Sessions, users, billing, and athlete reporting
        </p>
      </div>
      <AdminDashboardClient
        sessions={sessions}
        users={users}
        billing={billing}
        athleteReports={athleteReports}
        coachPayouts={coachPayouts}
        usersError={usersRes.error?.message ?? null}
      />
    </div>
  );
}
