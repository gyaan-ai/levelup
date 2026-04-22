import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { easternMonthRangeForCard } from '@/lib/admin-rewards-period';
import { isRewardsProgramEnabled, REFERRAL_CREDIT_AMOUNT } from '@/lib/rewards';
import { APP_TIMEZONE } from '@/lib/format-date';
import { toZonedTime } from 'date-fns-tz';
import { differenceInCalendarDays } from 'date-fns';

export const dynamic = 'force-dynamic';

function displayReferralStatus(
  row: Record<string, unknown>,
  pending: { released: boolean; available_at: string; amount: unknown } | null
): { key: string; label: string; tone: string } {
  const st = String(row.status ?? '');
  if (st === 'flagged') return { key: 'flagged', label: 'Flagged', tone: 'red' };
  if (st === 'expired') return { key: 'expired', label: 'Expired', tone: 'muted' };
  if (st === 'completed' && row.referrer_credit_id) return { key: 'released', label: 'Released', tone: 'green' };
  if (st === 'awaiting_release' && pending && !pending.released) {
    return { key: 'completed', label: 'Completed (hold)', tone: 'grey' };
  }
  if (st === 'pending') return { key: 'pending', label: 'Pending', tone: 'yellow' };
  return { key: 'other', label: st || '—', tone: 'muted' };
}

export async function GET() {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient(auth.tenantSlug);
  const { data: refs, error } = await admin
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(600);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const refList = refs ?? [];
  const userIds = [...new Set(refList.flatMap((r) => [r.referrer_id as string, r.referred_id as string]))];
  const { data: users } = await admin
    .from('users')
    .select('id, first_name, last_name')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const nameById = new Map(
    (users ?? []).map((u) => [
      u.id,
      [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || '—',
    ])
  );

  const refIds = refList.map((r) => r.id as string);
  const { data: pendRows } = await admin
    .from('pending_referral_credits')
    .select('referral_id, amount, available_at, released, frozen')
    .in('referral_id', refIds.length ? refIds : ['00000000-0000-0000-0000-000000000000']);

  type PendRow = {
    referral_id: string;
    amount: unknown;
    available_at: string;
    released: boolean;
    frozen: boolean | null;
  };
  const pendByRef = new Map<string, PendRow>();
  for (const p of (pendRows ?? []) as PendRow[]) pendByRef.set(p.referral_id, p);

  const { startIso, endIsoExclusive } = easternMonthRangeForCard('this_month');
  let completedThisMonth = 0;
  let pendingCount = 0;
  let expiredThisMonth = 0;
  for (const r of refList) {
    const st = r.status as string;
    const completedAt = r.completed_at as string | null;
    if (st === 'pending') pendingCount++;
    if (
      completedAt &&
      completedAt >= startIso &&
      completedAt < endIsoExclusive &&
      (st === 'awaiting_release' || st === 'completed')
    ) {
      completedThisMonth++;
    }
    if (st === 'expired') {
      const exAt = r.expires_at as string | null;
      if (exAt && exAt >= startIso && exAt < endIsoExclusive) expiredThisMonth++;
    }
  }

  const { data: refIssued } = await admin
    .from('credits')
    .select('amount')
    .eq('reward_type', 'referral_sent');
  const totalReferralCreditsIssued = (refIssued ?? []).reduce((s, c) => s + Number((c as { amount: unknown }).amount ?? 0), 0);

  const { data: holdInfo } = await admin.rpc('admin_rewards_pending_referrals_hold');
  const holdRow = Array.isArray(holdInfo) ? holdInfo[0] : holdInfo;
  const creditsInHold = Number((holdRow as { hold_total?: unknown })?.hold_total ?? 0);

  const now = new Date();
  const rows = refList.map((r) => {
    const pend = pendByRef.get(r.id as string) ?? null;
    const disp = displayReferralStatus(r as Record<string, unknown>, pend);
    let holdUntil: string | null = pend?.available_at ?? null;
    let releasedLabel = '—';
    if (pend?.released) {
      releasedLabel = 'Yes';
    } else if (pend && !pend.released && holdUntil) {
      const avail = new Date(holdUntil);
      const days = differenceInCalendarDays(avail, toZonedTime(now, APP_TIMEZONE));
      if (days > 0) releasedLabel = `No — ${days} day${days === 1 ? '' : 's'}`;
      else releasedLabel = 'Due';
    }
    if (r.referrer_credit_id) releasedLabel = 'Yes';

    return {
      id: r.id,
      referrer_id: r.referrer_id,
      referred_id: r.referred_id,
      referrer_name: nameById.get(r.referrer_id as string) ?? '—',
      referred_name: nameById.get(r.referred_id as string) ?? '—',
      status: r.status,
      display: disp,
      first_session_id: r.first_session_id,
      hold_until: holdUntil,
      released_label: releasedLabel,
      flagged_reason: r.flagged_reason ?? null,
      pending_frozen: pend?.frozen ?? false,
    };
  });

  const { data: topRef } = await admin.rpc('admin_rewards_parent_directory');
  const dir = (topRef ?? []) as Array<{ id: string; parent_name: string }>;
  const referrerStats = new Map<string, { count: number; earned: number }>();
  for (const r of refList) {
    if (r.status === 'expired' || r.status === 'pending') continue;
    const rid = r.referrer_id as string;
    const cur = referrerStats.get(rid) ?? { count: 0, earned: 0 };
    cur.count += 1;
    referrerStats.set(rid, cur);
  }
  const { data: refCreditRows } = await admin
    .from('credits')
    .select('parent_id, amount')
    .eq('reward_type', 'referral_sent');
  for (const c of refCreditRows ?? []) {
    const row = c as { parent_id: string; amount: unknown };
    const cur = referrerStats.get(row.parent_id) ?? { count: 0, earned: 0 };
    cur.earned += Number(row.amount ?? 0);
    referrerStats.set(row.parent_id, cur);
  }

  const topReferrers = [...referrerStats.entries()]
    .map(([id, v]) => ({
      id,
      name: dir.find((d) => d.id === id)?.parent_name ?? nameById.get(id) ?? '—',
      referrals: v.count,
      earned: Number(v.earned.toFixed(2)),
    }))
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 10);

  return NextResponse.json({
    rows,
    summary: {
      thisMonth: {
        completed: completedThisMonth,
        pending: pendingCount,
        expired: expiredThisMonth,
      },
      totalReferralCreditsIssued: Number(totalReferralCreditsIssued.toFixed(2)),
      creditsInHold: Number(creditsInHold.toFixed(2)),
      referralCreditAmount: REFERRAL_CREDIT_AMOUNT,
    },
    topReferrers,
  });
}
