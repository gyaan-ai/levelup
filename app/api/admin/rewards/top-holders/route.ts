import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { isRewardsProgramEnabled } from '@/lib/rewards';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isRewardsProgramEnabled()) {
    return NextResponse.json({ error: 'Rewards program disabled' }, { status: 404 });
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient(auth.tenantSlug);
  const { data: rows, error } = await admin.rpc('admin_rewards_parent_directory');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id: string;
    parent_name: string;
    current_balance: number;
  };

  const list = (rows ?? []) as Row[];
  const sorted = [...list]
    .map((r) => ({ ...r, current_balance: Number(r.current_balance ?? 0) }))
    .filter((r) => r.current_balance > 0)
    .sort((a, b) => b.current_balance - a.current_balance)
    .slice(0, 10);

  const ids = sorted.map((r) => r.id);
  const lastBooked = new Map<string, string>();

  if (ids.length) {
    const { data: parts } = await admin
      .from('session_participants')
      .select('parent_id, sessions(scheduled_datetime)')
      .eq('paid', true)
      .in('parent_id', ids);

    for (const p of parts ?? []) {
      const row = p as {
        parent_id: string;
        sessions: { scheduled_datetime: string } | { scheduled_datetime: string }[] | null;
      };
      const sess = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
      const dt = sess?.scheduled_datetime;
      if (!dt) continue;
      const cur = lastBooked.get(row.parent_id);
      if (!cur || dt > cur) lastBooked.set(row.parent_id, dt);
    }
  }

  return NextResponse.json({
    rows: sorted.map((r) => ({
      id: r.id,
      name: r.parent_name,
      balance: r.current_balance,
      last_booked: lastBooked.get(r.id) ?? null,
    })),
  });
}
