import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/format-date';

/** Given a date YYYY-MM-DD in Eastern, return ISO range for that calendar day (for DB queries). */
function dayRangeInTz(dateStr: string, tz: string): { start: string; end: string } {
  const ref = new Date(dateStr + 'T12:00:00.000Z');
  const zoned = toZonedTime(ref, tz);
  const startZoned = startOfDay(zoned);
  const endZoned = endOfDay(zoned);
  const startUTC = fromZonedTime(startZoned, tz);
  const endUTC = fromZonedTime(endZoned, tz);
  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
  };
}

/**
 * GET /api/admin/cockpit?date=YYYY-MM-DD&range=today|week|month&timezone=America/New_York
 * All dates/times are Eastern (EST/EDT). "Today" = current Eastern calendar day.
 */
export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const rangeParam = searchParams.get('range');
    const trendPeriod = (searchParams.get('trendPeriod') || '7d') as '7d' | '3w' | '12m';
    const tz = searchParams.get('timezone') || APP_TIMEZONE;
    // Default "today" to current date in Eastern so admins see their real day
    const todayEastern = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayEastern;
    const range = rangeParam === 'week' || rangeParam === 'month' ? rangeParam : 'today';

    let rangeStart = date;
    let rangeEnd = date;
    if (range === 'week') {
      const d = new Date(date + 'T12:00:00.000Z');
      d.setUTCDate(d.getUTCDate() - 6);
      rangeStart = d.toISOString().slice(0, 10);
    } else if (range === 'month') {
      const d = new Date(date + 'T12:00:00.000Z');
      d.setUTCDate(1);
      rangeStart = d.toISOString().slice(0, 10);
    }

    // Use Eastern (or requested tz) day boundaries so "Today" matches real signups/sessions
    const rangeStartBounds = dayRangeInTz(rangeStart, tz);
    const rangeEndBounds = dayRangeInTz(rangeEnd, tz);
    const dayStart = rangeStartBounds.start;
    const dayEnd = rangeEndBounds.end;
    const startMs = new Date(dayStart).getTime();
    const endMs = new Date(dayEnd).getTime();

    const admin = createAdminClient(tenant.slug);

    // Trend buckets: 7d = 7 days, 3w = 3 weeks, 12m = 12 months
    const trendEndDate = date;
    let trendRanges: { start: string; end: string; label: string }[] = [];
    if (trendPeriod === '7d') {
      const days = lastNDays(trendEndDate, 7);
      trendRanges = days.map((ds) => {
        const { start, end } = dayRangeInTz(ds, tz);
        const label = new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: tz });
        return { start, end, label };
      });
    } else if (trendPeriod === '3w') {
      const endRef = new Date(trendEndDate + 'T12:00:00.000Z');
      for (let i = 2; i >= 0; i--) {
        const weekEnd = subDays(endRef, i * 7);
        const weekStart = subDays(weekEnd, 6);
        const startStr = weekStart.toISOString().slice(0, 10);
        const endStr = weekEnd.toISOString().slice(0, 10);
        const { start, end } = dayRangeInTz(startStr, tz);
        const endRange = dayRangeInTz(endStr, tz);
        trendRanges.push({
          start,
          end: endRange.end,
          label: new Date(weekStart).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: tz }) + '–' + new Date(weekEnd).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: tz }),
        });
      }
    } else {
      // 12m: one bucket per month
      const endRef = new Date(trendEndDate + 'T12:00:00.000Z');
      for (let i = 11; i >= 0; i--) {
        const m = subMonths(endRef, i);
        const y = m.getUTCFullYear();
        const mon = m.getUTCMonth();
        const firstDay = `${y}-${String(mon + 1).padStart(2, '0')}-01`;
        const lastDate = new Date(Date.UTC(y, mon + 1, 0));
        const lastDay = `${y}-${String(mon + 1).padStart(2, '0')}-${String(lastDate.getUTCDate()).padStart(2, '0')}`;
        const startRange = dayRangeInTz(firstDay, tz);
        const endRange = dayRangeInTz(lastDay, tz);
        trendRanges.push({
          start: startRange.start,
          end: endRange.end,
          label: m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: tz }),
        });
      }
    }

    const [
      newParentsRes,
      newCoachesRes,
      newAthletesRes,
      sessionsScheduledRes,
      bookingsRes,
      earlyAccessRes,
      payoutsPaidRes,
      trendParentsRes,
      trendCoachesRes,
      trendAthletesRes,
      trendSessionsRes,
      trendBookingsRes,
      trendEarlyRes,
    ] = await Promise.all([
      admin.from('users').select('id, email, created_at').eq('role', 'parent').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: false }),
      admin.from('athletes').select('id, first_name, last_name, school, created_at').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: false }),
      admin.from('youth_wrestlers').select('id, first_name, last_name, parent_id, created_at').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: false }),
      admin.from('sessions').select('id, scheduled_datetime, status, session_type, session_mode, current_participants, max_participants, athletes(first_name, last_name, school), facilities(name)').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: false }),
      admin.from('session_participants').select('id, session_id, parent_id, youth_wrestler_id, amount_paid, created_at, youth_wrestlers(first_name, last_name), sessions(id, scheduled_datetime, athletes(first_name, last_name), facilities(name))').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: false }),
      admin.from('early_access').select('id, email, name, parent_name, wrestler_name, created_at').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: false }),
      admin.from('sessions').select('id, athlete_payment, athlete_payout_date, athletes(first_name, last_name)').eq('status', 'completed').gte('athlete_payout_date', rangeStart).lte('athlete_payout_date', rangeEnd),
      trendCountByRanges(admin, 'users', 'parent', trendRanges),
      trendCountByRanges(admin, 'athletes', null, trendRanges),
      trendCountByRanges(admin, 'youth_wrestlers', null, trendRanges),
      trendCountByRanges(admin, 'sessions', null, trendRanges),
      trendCountByRanges(admin, 'session_participants', null, trendRanges),
      trendCountByRanges(admin, 'early_access', null, trendRanges),
    ]);

    // Vercel Analytics (drain): page views and unique visitors in range (origin matches tenant domain or request host for previews)
    let pageViews = 0;
    let visitors = 0;
    try {
      const requestHost = host.replace(/^https?:\/\//, '').split(':')[0];
      const orFilter = `origin.ilike.%${tenant.domain}%,origin.ilike.%${requestHost}%`;
      const { data: analyticsRows } = await admin
        .from('vercel_analytics_events')
        .select('event_type, device_id')
        .gte('timestamp_ms', startMs)
        .lte('timestamp_ms', endMs)
        .or(orFilter)
        .limit(100000);
      if (analyticsRows && analyticsRows.length > 0) {
        const rows = analyticsRows as { event_type?: string; device_id?: number | null }[];
        pageViews = rows.filter((r) => r.event_type === 'pageview').length;
        const deviceIds = new Set(rows.map((r) => r.device_id).filter((id): id is number => id != null));
        visitors = deviceIds.size;
      }
    } catch {
      // Table may not exist yet or drain not configured
    }

    // Revenue that day: sum of amount_paid for participants CREATED that day (signups that day)
    let revenueThatDay = 0;
    if (bookingsRes.data) {
      for (const b of bookingsRes.data as { amount_paid?: number | null }[]) {
        const amt = (b as { amount_paid?: number | null }).amount_paid;
        if (amt != null && Number(amt) > 0) revenueThatDay += Number(amt);
      }
    }

    const payoutsPaid = (payoutsPaidRes.data ?? []).reduce((sum: number, s: { athlete_payment?: number }) => sum + Number(s.athlete_payment ?? 0), 0);
    const payoutsPaidList = (payoutsPaidRes.data ?? []).map((s: { id: string; athlete_payment?: number; athletes?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }) => {
      const a = s.athletes;
      const o = Array.isArray(a) ? a[0] : a;
      return { session_id: s.id, amount: Number(s.athlete_payment ?? 0), coach_name: o ? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() : '—' };
    });

    // Build trend arrays (last 7 days, oldest first)
    const trendDays = lastNDays(date, 7);
    const trends = {
      parents: trendParentsRes,
      coaches: trendCoachesRes,
      athletes: trendAthletesRes,
      sessions: trendSessionsRes,
      bookings: trendBookingsRes,
      earlyAccess: trendEarlyRes,
    };

    const trendLabels = trendRanges.map((r) => r.label);
    const trendDaysForResponse = trendRanges.map((r) => r.start.slice(0, 10));

    const newParents = (newParentsRes.data ?? []).map((p: { id: string; email: string; created_at: string }) => ({ id: p.id, email: p.email, created_at: p.created_at }));
    const newCoaches = (newCoachesRes.data ?? []).map((a: { id: string; first_name: string; last_name: string; school: string; created_at: string }) => ({
      id: a.id, name: `${a.first_name} ${a.last_name}`.trim(), school: a.school ?? '', created_at: a.created_at,
    }));
    const newAthletes = (newAthletesRes.data ?? []).map((y: { id: string; first_name: string; last_name: string; parent_id: string; created_at: string }) => ({
      id: y.id, name: `${y.first_name} ${y.last_name}`.trim(), parent_id: y.parent_id, created_at: y.created_at,
    }));

    const sessionsScheduled = (sessionsScheduledRes.data ?? []).map((s: {
      id: string; scheduled_datetime: string; status: string; session_type?: string; session_mode?: string; current_participants?: number; max_participants?: number;
      athletes?: { first_name: string; last_name: string; school: string } | { first_name: string; last_name: string; school: string }[];
      facilities?: { name: string } | { name: string }[];
    }) => {
      const a = s.athletes;
      const o = Array.isArray(a) ? a[0] : a;
      const f = s.facilities;
      const fo = Array.isArray(f) ? f[0] : f;
      return {
        id: s.id,
        scheduled_datetime: s.scheduled_datetime,
        status: s.status,
        session_type: s.session_type ?? '—',
        session_mode: s.session_mode ?? '—',
        coach_name: o ? `${o.first_name} ${o.last_name}` : '—',
        facility_name: fo?.name ?? '—',
        participants: `${s.current_participants ?? 0}/${s.max_participants ?? 1}`,
      };
    });

    const bookings = ((bookingsRes.data ?? []) as Array<{
      id: string;
      session_id: string;
      youth_wrestler_id?: string | null;
      amount_paid?: number | null;
      created_at: string;
      youth_wrestlers?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }> | null;
      sessions?: unknown;
    }>).map((b) => {
      const yw = b.youth_wrestlers;
      const ywOne = Array.isArray(yw) ? yw[0] : yw;
      const kid_name = ywOne ? `${ywOne.first_name ?? ''} ${ywOne.last_name ?? ''}`.trim() || '—' : '—';
      const sess = b.sessions as { scheduled_datetime?: string; athletes?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>; facilities?: { name?: string } | Array<{ name?: string }> } | Array<{ scheduled_datetime?: string; athletes?: unknown; facilities?: unknown }> | null | undefined;
      const s = Array.isArray(sess) ? sess[0] : sess;
      const a = s?.athletes;
      const o = Array.isArray(a) ? a[0] : a;
      const f = s?.facilities;
      const fo = Array.isArray(f) ? f[0] : f;
      return {
        id: b.id,
        session_id: b.session_id,
        amount_paid: b.amount_paid != null ? Number(b.amount_paid) : null,
        created_at: b.created_at,
        kid_name,
        coach_name: o ? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || '—' : '—',
        facility_name: fo?.name ?? '—',
        scheduled_datetime: s?.scheduled_datetime ?? '—',
      };
    });

    const earlyAccess = (earlyAccessRes.data ?? []).map((e: { id: string; email: string; name?: string | null; parent_name?: string | null; wrestler_name?: string | null; created_at: string }) => ({
      id: e.id,
      email: e.email,
      name: e.name ?? e.parent_name ?? e.wrestler_name ?? '—',
      created_at: e.created_at,
    }));

    return NextResponse.json({
      date,
      range,
      rangeStart,
      rangeEnd,
      pageViews,
      visitors,
      newParents,
      newCoaches,
      newAthletes,
      sessionsScheduled,
      bookings,
      earlyAccess,
      payoutsPaid,
      payoutsPaidList,
      revenueThatDay,
      trends,
      trendDays: trendDaysForResponse,
      trendLabels,
      trendPeriod,
    });
  } catch (e) {
    console.error('Cockpit API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function lastNDays(untilDate: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(untilDate + 'T12:00:00.000Z');
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

async function trendCountByRanges(
  admin: ReturnType<typeof createAdminClient>,
  table: 'users' | 'athletes' | 'youth_wrestlers' | 'sessions' | 'session_participants' | 'early_access',
  role: string | null,
  ranges: { start: string; end: string }[]
): Promise<number[]> {
  const counts: number[] = [];
  for (const { start, end } of ranges) {
    const base = (admin as any).from(table).select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end);
    const q = table === 'users' && role ? base.eq('role', role) : base;
    const { count, error } = await q;
    counts.push(error ? 0 : (count ?? 0));
  }
  return counts;
}
