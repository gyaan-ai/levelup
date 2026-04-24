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

  const { data: u } = await admin.from('users').select('id, role').eq('id', parentId).maybeSingle();
  if (!u || (u as { role: string }).role !== 'parent') {
    return NextResponse.json({ error: 'Parent not found' }, { status: 400 });
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
