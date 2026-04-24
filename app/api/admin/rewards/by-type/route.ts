import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { easternMonthBoundsFromYearMonth } from '@/lib/admin-rewards-period';
import { isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

const BUCKET_LABEL: Record<string, string> = {
  session: 'Session (legacy 5% back)',
  referral: 'Referral',
  milestone: 'Milestone',
  review: 'Review',
  cancellation: 'Cancellation',
  manual: 'Manual',
  promotion: 'Promotion',
  other: 'Other',
};

export async function GET(req: NextRequest) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const y = parseInt(req.nextUrl.searchParams.get('year') || '', 10);
  const m = parseInt(req.nextUrl.searchParams.get('month') || '', 10);
  const now = new Date();
  const year = Number.isFinite(y) ? y : now.getUTCFullYear();
  const month = Number.isFinite(m) ? Math.min(12, Math.max(1, m)) : now.getUTCMonth() + 1;

  const { startIso, endIsoExclusive } = easternMonthBoundsFromYearMonth(year, month);
  const admin = createAdminClient(auth.tenantSlug);

  const { data: rows, error } = await admin.rpc('admin_rewards_by_type_month', {
    p_start: startIso,
    p_end: endIsoExclusive,
  });
  if (error) {
    console.error('admin_rewards_by_type_month', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows ?? []) as Array<{
    bucket: string;
    issued: unknown;
    redeemed: unknown;
    outstanding?: unknown;
  }>;
  const mapped = list.map((r) => {
    const issued = Number(r.issued ?? 0);
    const redeemed = Number(r.redeemed ?? 0);
    const outstanding = Number(r.outstanding ?? 0);
    return {
      type: r.bucket,
      label: BUCKET_LABEL[r.bucket] ?? r.bucket,
      issued,
      redeemed,
      outstanding: Number(outstanding.toFixed(2)),
    };
  });

  const totals = mapped.reduce(
    (acc, r) => {
      acc.issued += r.issued;
      acc.redeemed += r.redeemed;
      acc.outstanding += r.outstanding;
      return acc;
    },
    { issued: 0, redeemed: 0, outstanding: 0 }
  );

  return NextResponse.json(
    {
      year,
      month,
      startIso,
      rows: mapped,
      totals: {
        issued: Number(totals.issued.toFixed(2)),
        redeemed: Number(totals.redeemed.toFixed(2)),
        outstanding: Number(totals.outstanding.toFixed(2)),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
}
