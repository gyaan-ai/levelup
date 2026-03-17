import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase.from('users').select('role').eq('id', userId).single();
}

/** GET - List all discount codes (admin). */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: userData } = await requireAdmin(supabase, user.id);
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient(tenant.slug);
    const { data: rows, error } = await admin
      .from('discount_codes')
      .select('id, code, name, max_redemptions, redemptions, active, percent_off, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ codes: rows ?? [] });
  } catch (e) {
    console.error('Admin discount-codes GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST - Create a discount code (admin). Body: { code, name?, max_redemptions? } */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: userData } = await requireAdmin(supabase, user.id);
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const name = typeof body?.name === 'string' ? body.name.trim() || null : null;
    const maxRedemptions = typeof body?.max_redemptions === 'number' && body.max_redemptions >= 0
      ? body.max_redemptions
      : typeof body?.max_redemptions === 'string' && body.max_redemptions.trim() === ''
        ? null
        : typeof body?.max_redemptions === 'string'
          ? parseInt(body.max_redemptions, 10)
          : null;
    const max = Number.isNaN(maxRedemptions) || maxRedemptions === null ? null : Math.max(0, maxRedemptions);
    const percentOff = body?.percent_off != null
      ? (typeof body.percent_off === 'number' ? body.percent_off : parseInt(String(body.percent_off), 10))
      : null;
    const percentOffValid = percentOff != null && !Number.isNaN(percentOff) && percentOff >= 1 && percentOff <= 100 ? percentOff : null;

    const admin = createAdminClient(tenant.slug);
    const { data: row, error } = await admin
      .from('discount_codes')
      .insert({
        code,
        name: name ?? undefined,
        max_redemptions: max ?? undefined,
        redemptions: 0,
        percent_off: percentOffValid ?? undefined,
      })
      .select('id, code, name, max_redemptions, redemptions, percent_off, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A code with this value already exists' }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ code: row });
  } catch (e) {
    console.error('Admin discount-codes POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH - Pause or unpause a discount code. Body: { id: string, active: boolean } */
export async function PATCH(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: userData } = await requireAdmin(supabase, user.id);
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const active = body?.active;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (typeof active !== 'boolean') return NextResponse.json({ error: 'active must be true or false' }, { status: 400 });

    const admin = createAdminClient(tenant.slug);
    const { data: row, error } = await admin
      .from('discount_codes')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, code, active')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ code: row });
  } catch (e) {
    console.error('Admin discount-codes PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
