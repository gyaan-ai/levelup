import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { isRewardsProgramEnabled, releaseReferralCreditEarly } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: referralId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 3) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });

  const admin = createAdminClient(auth.tenantSlug);
  const res = await releaseReferralCreditEarly(admin, {
    referralId,
    tenantSlug: auth.tenantSlug,
    reason,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
