import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: parentId } = await ctx.params;
  if (!parentId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '80', 10) || 80));

  const admin = createAdminClient(auth.tenantSlug);
  const { data: rows, error } = await admin.rpc('admin_rewards_parent_ledger', {
    p_parent_id: parentId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.error('admin_rewards_parent_ledger', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: userRow } = await admin
    .from('users')
    .select('first_name, last_name')
    .eq('id', parentId)
    .maybeSingle();
  const u = userRow as { first_name?: string; last_name?: string } | null;
  const parentName = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || 'Parent';

  const { data: balRows } = await admin
    .from('credits')
    .select('remaining, expires_at')
    .eq('parent_id', parentId);
  const nowIso = new Date().toISOString();
  let currentBalance = 0;
  for (const c of balRows ?? []) {
    const row = c as { remaining: unknown; expires_at: string | null };
    if (row.expires_at && row.expires_at <= nowIso) continue;
    currentBalance += Number(row.remaining ?? 0);
  }

  return NextResponse.json({
    parentId,
    parentName,
    currentBalance: Number(currentBalance.toFixed(2)),
    rows: (rows ?? []).map((r: Record<string, unknown>) => ({
      entry_ts: r.entry_ts,
      entry_kind: r.entry_kind,
      entry_id: r.entry_id,
      description: r.description,
      reward_type: r.reward_type,
      amount: Number(r.amount ?? 0),
      balance_after: Number(r.balance_after ?? 0),
      credit_row_id: r.credit_row_id,
    })),
    nextOffset: offset + limit,
  });
}
