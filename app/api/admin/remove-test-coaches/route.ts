import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/** POST - remove all test coaches (athletes). Run "Clear test data" first to remove sessions. Admin only. */
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

    // coach_follows references athletes; delete first so we can delete athletes
    try {
      const { data } = await admin.from('coach_follows').delete().neq('parent_id', '00000000-0000-0000-0000-000000000000').select('parent_id');
      counts['coach_follows'] = data?.length ?? 0;
    } catch {
      counts['coach_follows'] = 0;
    }

    // Check for sessions still referencing athletes (user should run Clear test data first)
    const { data: sessionCount } = await admin.from('sessions').select('id', { count: 'exact', head: true });
    if ((sessionCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Run "Clear test data" first to remove sessions, then try again.', counts },
        { status: 400 }
      );
    }

    // athlete_availability_slots, athlete_products, etc. may reference athletes - delete athletes last; CASCADE will remove workspaces
    try {
      const { data } = await admin.from('athletes').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
      counts['athletes'] = data?.length ?? 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
        return NextResponse.json(
          { error: 'Run "Clear test data" first to remove sessions and related data, then try again.', counts },
          { status: 400 }
        );
      }
      throw e;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ ok: true, counts, total });
  } catch (e) {
    console.error('Remove test coaches error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 });
  }
}
