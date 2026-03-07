import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET: current parent's early adopter free-session balance (1-on-1 and 2-athlete). */
export async function GET(_req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ free1on1: 0, free2Athlete: 0 });
    }

    const { data: rows } = await supabase
      .from('early_adopter_entitlements')
      .select('session_type, remaining')
      .eq('parent_id', user.id)
      .gt('remaining', 0);

    const free1on1 = (rows || []).filter((r) => r.session_type === '1-on-1').reduce((s, r) => s + (r.remaining ?? 0), 0);
    const free2Athlete = (rows || []).filter((r) => r.session_type === '2-athlete').reduce((s, r) => s + (r.remaining ?? 0), 0);

    return NextResponse.json({ free1on1, free2Athlete });
  } catch (e) {
    console.error('Early adopter entitlements error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
