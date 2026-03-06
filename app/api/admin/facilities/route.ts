import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  return async (req: NextRequest) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return null;
  };
}

// GET /api/admin/facilities - List all facilities (admin only)
export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const authError = await requireAdmin(supabase)(req);
    if (authError) return authError;

    const admin = createAdminClient(tenant.slug);
    const { data: facilities, error } = await admin
      .from('facilities')
      .select('id, name, school, address, created_at')
      .order('school')
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ facilities: facilities ?? [] });
  } catch (e) {
    console.error('Facilities GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/facilities - Create a facility (admin only). Coaches then pick from this list.
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const authError = await requireAdmin(supabase)(req);
    if (authError) return authError;

    const body = await req.json();
    const { name, school, address } = body;
    if (!name || !school || typeof name !== 'string' || typeof school !== 'string') {
      return NextResponse.json({ error: 'Name and school are required' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: facility, error } = await admin
      .from('facilities')
      .insert({
        name: name.trim(),
        school: school.trim(),
        address: address && typeof address === 'string' ? address.trim() || null : null,
      })
      .select('id, name, school, address, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A facility with this school and name already exists.' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ facility });
  } catch (e) {
    console.error('Facilities POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
