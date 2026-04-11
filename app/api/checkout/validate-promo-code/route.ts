import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { resolvePromoCodePercentForCheckout } from '@/lib/checkout-promo';

/**
 * POST { code } — preview percent for checkout UI. Does not redeem or write DB.
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const codeRaw = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!codeRaw) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const percentOff = await resolvePromoCodePercentForCheckout(admin, codeRaw, user.email);
    if (percentOff < 1) {
      return NextResponse.json({ error: 'Invalid, inactive, or expired promo code' }, { status: 400 });
    }

    return NextResponse.json({ percent_off: percentOff });
  } catch (e) {
    console.error('validate-promo-code:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
