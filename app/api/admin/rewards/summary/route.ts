import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { easternMonthRangeForCard, type RewardsCardPeriod } from '@/lib/admin-rewards-period';
import { isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const period = (req.nextUrl.searchParams.get('period') || 'this_month') as RewardsCardPeriod;
  const admin = createAdminClient(auth.tenantSlug);

  const { data: liabRows, error: lErr } = await admin.rpc('admin_rewards_outstanding_liability');
  if (lErr) {
    console.error('admin_rewards_outstanding_liability', lErr);
    return NextResponse.json({ error: lErr.message }, { status: 500 });
  }
  const totalOutstanding = Number(typeof liabRows === 'number' ? liabRows : (liabRows as unknown) ?? 0);

  const nowIso = new Date().toISOString();
  const rangeStart = '1970-01-01T00:00:00.000Z';
  const range =
    period === 'all'
      ? { startIso: rangeStart, endIsoExclusive: nowIso }
      : easternMonthRangeForCard(period);

  const { data: issuedRaw, error: iErr } = await admin.rpc('admin_rewards_issued_in_range', {
    p_start: range.startIso,
    p_end: range.endIsoExclusive,
  });
  if (iErr) {
    console.error('admin_rewards_issued_in_range', iErr);
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  const { data: redeemedRaw, error: rErr } = await admin.rpc('admin_rewards_redeemed_in_range', {
    p_start: range.startIso,
    p_end: range.endIsoExclusive,
  });
  if (rErr) {
    console.error('admin_rewards_redeemed_in_range', rErr);
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  const { data: pendRows, error: pErr } = await admin.rpc('admin_rewards_pending_referrals_hold');
  if (pErr) {
    console.error('admin_rewards_pending_referrals_hold', pErr);
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const pend = Array.isArray(pendRows) ? pendRows[0] : pendRows;
  const pendingCount = Number((pend as { cnt?: unknown })?.cnt ?? 0);
  const pendingHoldTotal = Number((pend as { hold_total?: unknown })?.hold_total ?? 0);

  const issued = (issuedRaw ?? {}) as Record<string, number>;

  return NextResponse.json({
    period,
    totalOutstanding,
    issued: {
      total: Number(issued.total ?? 0),
      breakdown: {
        session: Number(issued.session ?? 0),
        referral: Number(issued.referral ?? 0),
        milestone: Number(issued.milestone ?? 0),
        review: Number(issued.review ?? 0),
        manual: Number(issued.manual ?? 0),
        cancellation: Number(issued.cancellation ?? 0),
        promotion: Number(issued.promotion ?? 0),
        other: Number(issued.other ?? 0),
      },
    },
    redeemedThisPeriod: Number(typeof redeemedRaw === 'number' ? redeemedRaw : (redeemedRaw as unknown) ?? 0),
    pendingReferrals: { count: pendingCount, holdTotalUsd: pendingHoldTotal },
  });
}
