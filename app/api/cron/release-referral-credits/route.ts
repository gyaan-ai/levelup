import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenants } from '@/config/tenants';
import { expireStaleReferrals, isRewardsProgramEnabled, releaseDueReferralCredits } from '@/lib/rewards';

/**
 * Daily: expire stale referrals; release referral credits past 7-day hold.
 * Production: Authorization: Bearer CRON_SECRET (or ?secret=)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');
  if (process.env.NODE_ENV === 'production') {
    const ok = secret && (auth === `Bearer ${secret}` || querySecret === secret);
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'REWARDS_PROGRAM_ENABLED is not true' });
  }

  const byTenant: Record<string, { expired: number; released: number }> = {};
  for (const slug of Object.keys(tenants)) {
    try {
      const admin = createAdminClient(slug);
      const expired = await expireStaleReferrals(admin);
      const { released } = await releaseDueReferralCredits(admin, slug);
      byTenant[slug] = { expired, released };
    } catch (e) {
      console.error(`release-referral-credits ${slug}:`, e);
      byTenant[slug] = { expired: 0, released: 0 };
    }
  }

  return NextResponse.json({ ok: true, byTenant });
}
