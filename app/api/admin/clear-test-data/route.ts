import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/** POST - clear test data (sessions, participants, join requests, notes, coach inquiries, notifications). Admin only. */
export async function POST() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient(tenant.slug);
    const counts: Record<string, number> = {};

    const deleteAllFrom = async (table: string, idColumn = 'id'): Promise<number> => {
      const { data, error } = await admin
        .from(table)
        .delete()
        .neq(idColumn, '00000000-0000-0000-0000-000000000000')
        .select(idColumn);
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) return 0;
        throw error;
      }
      return data?.length ?? 0;
    };

    // Delete in FK-safe order (dependents before sessions)
    const steps: Array<[string, string?]> = [
      ['session_join_requests'],
      ['session_participants'],
      ['workspace_actions'],
      ['workspace_session_notes'],
      ['session_summaries'],
      ['booking_messages'],
      ['sessions'],
      ['coach_inquiries'],
      ['notifications'],
    ];

    for (const [table, col] of steps) {
      try {
        const n = await deleteAllFrom(table, col ?? 'id');
        counts[table] = n;
      } catch (e) {
        counts[table] = 0;
      }
    }

    // coach_inquiry_thread_read has composite PK (user_id, parent_id, athlete_id)
    try {
      const { data: rows } = await admin.from('coach_inquiry_thread_read').select('user_id');
      const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
      if (userIds.length > 0) {
        const { error } = await admin.from('coach_inquiry_thread_read').delete().in('user_id', userIds);
        counts['coach_inquiry_thread_read'] = error ? 0 : rows?.length ?? 0;
      } else {
        counts['coach_inquiry_thread_read'] = 0;
      }
    } catch {
      counts['coach_inquiry_thread_read'] = 0;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ ok: true, counts, total });
  } catch (e) {
    console.error('Clear test data error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 });
  }
}
