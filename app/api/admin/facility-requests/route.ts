import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

async function requireAdmin(tenantSlug: string) {
  const supabase = await createClient(tenantSlug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

// GET /api/admin/facility-requests - list all (or pending only)
export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug);
    if (authError) return authError;

    const admin = createAdminClient(tenant.slug);
    const { data: rows, error } = await admin
      .from('facility_requests')
      .select(`
        id,
        requested_by_athlete_id,
        name,
        school,
        address,
        status,
        created_at,
        resolved_at,
        resolved_facility_id,
        athletes(id, first_name, last_name, school)
      `)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const requests = (rows ?? []).map((r: { athletes?: { id: string; first_name: string; last_name: string; school: string } | Array<{ id: string; first_name: string; last_name: string; school: string }> }) => {
      const a = r.athletes;
      const o = Array.isArray(a) ? a[0] : a;
      return {
        ...r,
        coach_name: o ? `${o.first_name} ${o.last_name}` : '—',
        coach_school: o?.school ?? '—',
      };
    });
    return NextResponse.json({ requests });
  } catch (e) {
    console.error('Admin facility-requests GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
