import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

/** Grant rows with remaining balance (for revoke picker). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: parentId } = await ctx.params;
  const admin = createAdminClient(auth.tenantSlug);
  const { data, error } = await admin
    .from('credits')
    .select('id, amount, remaining, reward_type, source, description, created_at')
    .eq('parent_id', parentId)
    .gt('remaining', 0)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ grants: data ?? [] });
}
