import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function requireAdminApi(): Promise<
  | { ok: true; tenantSlug: string; userId: string }
  | { ok: false; response: NextResponse }
> {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) {
    return { ok: false, response: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) };
  }

  const supabase = await createClient(tenant.slug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, tenantSlug: tenant.slug, userId: user.id };
}
