import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/** GET: current user's percentage discount (e.g. 10 for 10% off). Parents only. */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ percent_off: null });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ percent_off: null });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: row } = await admin
      .from('parent_percentage_discounts')
      .select('percent_off')
      .eq('parent_id', user.id)
      .maybeSingle();

    const percentOff = row?.percent_off != null ? Number(row.percent_off) : null;
    return NextResponse.json({ percent_off: percentOff });
  } catch (e) {
    console.error('Percentage discount error:', e);
    return NextResponse.json({ percent_off: null });
  }
}
