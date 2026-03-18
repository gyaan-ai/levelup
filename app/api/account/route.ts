import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** PATCH: update current user's profile (e.g. phone). */
export async function PATCH(req: Request) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;

    const { error } = await supabase.from('users').update({ phone }).eq('id', user.id);

    if (error) {
      console.error('Account PATCH error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, phone });
  } catch (e) {
    console.error('Account PATCH error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
