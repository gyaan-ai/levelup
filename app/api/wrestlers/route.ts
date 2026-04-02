import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { getWrestlersForParentUser } from '@/lib/wrestlers-for-parent';

export async function GET() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) return NextResponse.json({ wrestlers: [] });

  const supabase = await createClient(tenant.slug);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ wrestlers: [] });
  }

  try {
    const rows = await getWrestlersForParentUser(supabase, user.id);
    const wrestlers = rows.map(({ id, first_name, last_name }) => ({ id, first_name, last_name }));
    return NextResponse.json({ wrestlers });
  } catch (e) {
    console.error('GET /api/wrestlers', e);
    return NextResponse.json({ wrestlers: [], error: 'Failed to load wrestlers' }, { status: 500 });
  }
}
