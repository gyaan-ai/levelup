import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { resolveDiscountPercentOff } from '@/lib/discount-codes';

/**
 * POST - Parent redeems a discount code after signup (e.g. they forgot at signup).
 * Body: { code: string }
 * Percent-off codes (e.g. FAMILY10) grant `parent_percentage_discounts`. Early-adopter free sessions are disabled.
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

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Only parents can redeem discount codes' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const codeRaw = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!codeRaw) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const codeNormalized = codeRaw.toUpperCase();
    const admin = createAdminClient(tenant.slug);

    const { data: codeRow, error: codeErr } = await admin
      .from('discount_codes')
      .select('id, code, max_redemptions, redemptions, active, percent_off')
      .eq('code', codeNormalized)
      .maybeSingle();

    if (codeErr) {
      console.error('Redeem code lookup error:', codeErr);
      return NextResponse.json({
        error: "We couldn't verify this code. Make sure the code exists in the database (run Supabase migrations or add it in Admin → Discount codes).",
      }, { status: 400 });
    }
    if (!codeRow) {
      return NextResponse.json({
        error: 'Code not found. Check the spelling or ask an admin to add it in Admin → Discount codes.',
      }, { status: 400 });
    }
    if (codeRow.active === false) {
      return NextResponse.json({ error: 'This discount code is no longer active' }, { status: 400 });
    }

    const max = codeRow.max_redemptions;
    const current = codeRow.redemptions ?? 0;
    if (max != null && current >= max) {
      return NextResponse.json({ error: 'This discount code has reached its limit' }, { status: 400 });
    }

    const percentOff = resolveDiscountPercentOff(codeRow.code, codeRow.percent_off);

    if (percentOff != null) {
      // Percentage-off code (e.g. family 10% off): grant this parent the discount
      const { data: existingPct } = await admin
        .from('parent_percentage_discounts')
        .select('id')
        .eq('parent_id', user.id)
        .maybeSingle();
      if (existingPct) {
        return NextResponse.json({ success: true, alreadyUsed: true, message: 'You already have a discount.' }, { status: 200 });
      }
      const { error: insErr } = await admin.from('parent_percentage_discounts').insert({
        parent_id: user.id,
        discount_code_id: codeRow.id,
        percent_off: percentOff,
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      await admin.from('discount_codes').update({ redemptions: current + 1, updated_at: new Date().toISOString() }).eq('id', codeRow.id);
      return NextResponse.json({ success: true, message: `Code applied. You get ${percentOff}% off all sessions.` });
    }

    return NextResponse.json(
      {
        error:
          'This code does not include a percent discount. Family codes use FAMILY10-style (10% off), or an admin must set "Percent off" on the code in Admin → Discount codes.',
      },
      { status: 400 }
    );
  } catch (e) {
    console.error('Redeem discount code error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
