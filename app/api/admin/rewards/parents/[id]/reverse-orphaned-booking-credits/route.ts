import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { reverseOrphanedBookingCredits } from '@/lib/reverse-orphaned-booking-credits';
import { getUserCreditBalance } from '@/lib/credits';

export const dynamic = 'force-dynamic';

/**
 * POST — Restore wallet balance when credits were debited for a session but this parent has
 * no `session_participants` row on that session (failed registration after applyCredits).
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: parentId } = await ctx.params;
  const admin = createAdminClient(auth.tenantSlug);

  const { data: u } = await admin.from('users').select('id').eq('id', parentId).maybeSingle();
  if (!u) {
    return NextResponse.json({ error: 'User not found' }, { status: 400 });
  }
  const { count: creditRowCount } = await admin
    .from('credits')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', parentId);
  if ((creditRowCount ?? 0) === 0) {
    return NextResponse.json({ error: 'No wallet (credits) for this user' }, { status: 400 });
  }

  try {
    const { restoredUsd, reversedUsageRowCount } = await reverseOrphanedBookingCredits(admin, parentId);
    const balance = await getUserCreditBalance(parentId, auth.tenantSlug);
    return NextResponse.json({
      ok: true,
      restoredUsd,
      reversedUsageRowCount,
      balanceAfter: balance,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Reverse failed';
    console.error('reverse-orphaned-booking-credits', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
