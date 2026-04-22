import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

type DirRow = {
  id: string;
  parent_name: string;
  session_count: number;
  total_earned: number;
  total_redeemed: number;
  current_balance: number;
  last_activity: string;
};

export async function GET(req: NextRequest) {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  const sort = req.nextUrl.searchParams.get('sort') || 'balance_desc';
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '50', 10) || 50));

  const admin = createAdminClient(auth.tenantSlug);
  const { data: rows, error } = await admin.rpc('admin_rewards_parent_directory');
  if (error) {
    console.error('admin_rewards_parent_directory', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let list = (rows ?? []) as DirRow[];
  list = list.map((r) => ({
    ...r,
    session_count: Number(r.session_count ?? 0),
    total_earned: Number(r.total_earned ?? 0),
    total_redeemed: Number(r.total_redeemed ?? 0),
    current_balance: Number(r.current_balance ?? 0),
  }));

  if (q) {
    list = list.filter((r) => (r.parent_name || '').toLowerCase().includes(q));
  }

  const sortMatch = sort.match(/^(.*)_(asc|desc)$/);
  const field = sortMatch?.[1] || 'balance';
  const dir = sortMatch?.[2] === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    const cmp = (x: number | string, y: number | string) => (x < y ? -1 : x > y ? 1 : 0);
    if (field === 'name') return dir * cmp(a.parent_name, b.parent_name);
    if (field === 'sessions') return dir * cmp(a.session_count, b.session_count);
    if (field === 'earned') return dir * cmp(a.total_earned, b.total_earned);
    if (field === 'redeemed') return dir * cmp(a.total_redeemed, b.total_redeemed);
    if (field === 'activity' || field === 'last') return dir * cmp(a.last_activity, b.last_activity);
    return dir * cmp(a.current_balance, b.current_balance);
  });

  const total = list.length;
  const slice = list.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({ rows: slice, total, page, pageSize });
}
