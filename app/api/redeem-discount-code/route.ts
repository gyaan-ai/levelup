import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/**
 * POST - Parent redeems a discount code after signup (e.g. they forgot at signup).
 * Body: { code: string }
 * Validates code, ensures parent has not already redeemed it, grants 1 free 1-on-1 + 1 free 2-athlete and increments code redemptions.
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
      .select('id, code, max_redemptions, redemptions')
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

    const max = codeRow.max_redemptions;
    const current = codeRow.redemptions ?? 0;
    if (max != null && current >= max) {
      return NextResponse.json({ error: 'This discount code has reached its limit' }, { status: 400 });
    }

    const { data: existing } = await admin
      .from('early_adopter_entitlements')
      .select('id')
      .eq('parent_id', user.id)
      .eq('discount_code', codeRow.code)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, alreadyUsed: true, message: 'You already have this benefit.' }, { status: 200 });
    }

    const { error: ent1 } = await admin.from('early_adopter_entitlements').insert({
      parent_id: user.id,
      session_type: '1-on-1',
      remaining: 1,
      discount_code: codeRow.code,
    });
    if (ent1) return NextResponse.json({ error: ent1.message }, { status: 500 });

    const { error: ent2 } = await admin.from('early_adopter_entitlements').insert({
      parent_id: user.id,
      session_type: '2-athlete',
      remaining: 1,
      discount_code: codeRow.code,
    });
    if (ent2) return NextResponse.json({ error: ent2.message }, { status: 500 });

    await admin
      .from('discount_codes')
      .update({ redemptions: current + 1, updated_at: new Date().toISOString() })
      .eq('id', codeRow.id);

    return NextResponse.json({ success: true, message: 'Code applied. You have 1 free private and 1 free small group session.' });
  } catch (e) {
    console.error('Redeem discount code error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
