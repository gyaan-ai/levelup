import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { checkoutAllowSavedAccountPercent, displayPercentForPromoOnlyCheckout } from '@/lib/checkout-promo';
import { effectivePercentOffForCheckout } from '@/lib/family-auto-discount';

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
    if (!checkoutAllowSavedAccountPercent()) {
      const implicit = await displayPercentForPromoOnlyCheckout(admin, user.email);
      return NextResponse.json({ percent_off: implicit >= 1 ? implicit : null });
    }

    const { data: row } = await admin
      .from('parent_percentage_discounts')
      .select('percent_off')
      .eq('parent_id', user.id)
      .maybeSingle();

    const eff = effectivePercentOffForCheckout(row?.percent_off, user.email);
    return NextResponse.json({ percent_off: eff >= 1 ? eff : null });
  } catch (e) {
    console.error('Percentage discount error:', e);
    return NextResponse.json({ percent_off: null });
  }
}
