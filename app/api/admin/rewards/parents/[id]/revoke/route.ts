import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { adminRevokeCreditGrant, isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: parentId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const creditId = typeof body?.credit_id === 'string' ? body.credit_id.trim() : '';
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!creditId) return NextResponse.json({ error: 'credit_id is required' }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0.01) {
    return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
  }
  if (reason.length < 3) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });

  const admin = createAdminClient(auth.tenantSlug);
  const res = await adminRevokeCreditGrant(admin, {
    creditId,
    parentId,
    amount: Number(amount.toFixed(2)),
    reason,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
