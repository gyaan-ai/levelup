import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const coachId = (req.nextUrl.searchParams.get('coachId') || '').trim();
  const typesRaw = (req.nextUrl.searchParams.get('types') || '').trim();
  const types = typesRaw ? typesRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const from = (req.nextUrl.searchParams.get('from') || '').trim();
  const to = (req.nextUrl.searchParams.get('to') || '').trim();

  const admin = createAdminClient(auth.tenantSlug);
  const { data: parts, error } = await admin
    .from('session_participants')
    .select(
      `
      id,
      parent_id,
      amount_paid,
      sessions!inner (
        id,
        scheduled_datetime,
        session_type,
        athlete_id,
        athletes:athlete_id (first_name, last_name)
      ),
      users (first_name, last_name)
    `
    )
    .eq('paid', true)
    .order('created_at', { ascending: false })
    .limit(800);
  if (error) {
    console.error('admin rewards sessions', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type PartRow = {
    id: string;
    parent_id: string;
    amount_paid: unknown;
    sessions: {
      id: string;
      scheduled_datetime: string;
      session_type: string | null;
      athlete_id: string;
      athletes: { first_name?: string; last_name?: string } | null;
    };
    users: { first_name?: string; last_name?: string } | null;
  };

  const list = (parts ?? []) as unknown as PartRow[];
  const partIds = list.map((p) => p.id);
  const sessionIds = [...new Set(list.map((p) => p.sessions.id))];

  const [{ data: usageRows }, { data: earnRows }] = await Promise.all([
    sessionIds.length
      ? admin
          .from('credit_usage')
          .select('session_id, amount, credits!inner(parent_id)')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    partIds.length
      ? admin
          .from('credits')
          .select('session_participant_id, amount')
          .eq('reward_type', 'session_earned')
          .in('session_participant_id', partIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const usageByKey = new Map<string, number>();
  for (const u of usageRows ?? []) {
    const row = u as {
      session_id: string;
      amount: unknown;
      credits: { parent_id: string };
    };
    const pid = row.credits?.parent_id;
    if (!pid) continue;
    const k = `${row.session_id}:${pid}`;
    usageByKey.set(k, (usageByKey.get(k) ?? 0) + Number(row.amount ?? 0));
  }

  const earnByPart = new Map<string, number>();
  for (const e of earnRows ?? []) {
    const row = e as { session_participant_id: string; amount: unknown };
    if (row.session_participant_id) {
      earnByPart.set(row.session_participant_id, Number(row.amount ?? 0));
    }
  }

  const siblings = new Map<string, number>();
  for (const p of list) {
    const k = `${p.sessions.id}:${p.parent_id}`;
    siblings.set(k, (siblings.get(k) ?? 0) + 1);
  }

  const coachName = (a: { first_name?: string; last_name?: string } | null) =>
    [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim() || '—';

  let rows = list.map((p) => {
    const listPrice = Number(p.amount_paid ?? 0);
    const sk = `${p.sessions.id}:${p.parent_id}`;
    const rawApplied = usageByKey.get(sk) ?? 0;
    const nSib = siblings.get(sk) ?? 1;
    const creditsApplied = Number((rawApplied / nSib).toFixed(2));
    const cashCollected = Number((listPrice - creditsApplied).toFixed(2));
    const creditEarned = earnByPart.get(p.id) ?? 0;
    return {
      session_date: p.sessions.scheduled_datetime,
      session_type: p.sessions.session_type,
      coach_id: p.sessions.athlete_id,
      coach_name: coachName(p.sessions.athletes),
      parent_id: p.parent_id,
      parent_name: coachName(p.users),
      list_price: listPrice,
      credits_applied: creditsApplied,
      cash_collected: cashCollected,
      session_credit_earned: creditEarned,
      session_id: p.sessions.id,
      participant_id: p.id,
    };
  });

  rows.sort((a, b) => (a.session_date < b.session_date ? 1 : a.session_date > b.session_date ? -1 : 0));

  if (coachId) rows = rows.filter((r) => r.coach_id === coachId);
  if (types.length) rows = rows.filter((r) => r.session_type && types.includes(r.session_type));
  if (from) rows = rows.filter((r) => r.session_date >= from);
  if (to) rows = rows.filter((r) => r.session_date <= `${to}T23:59:59.999Z`);

  const coachOptions = [...new Map(rows.map((r) => [r.coach_id, r.coach_name])).entries()].map(([id, name]) => ({
    id,
    name,
  }));

  return NextResponse.json({ rows, coachOptions });
}
