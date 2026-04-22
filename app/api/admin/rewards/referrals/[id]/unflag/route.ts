import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { isRewardsProgramEnabled, unflagReferral } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: referralId } = await ctx.params;
  const admin = createAdminClient(auth.tenantSlug);
  const res = await unflagReferral(admin, { referralId });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
