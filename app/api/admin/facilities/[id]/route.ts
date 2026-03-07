import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

async function requireAdmin(tenantSlug: string, req: NextRequest) {
  const supabase = await createClient(tenantSlug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug, req);
    if (authError) return authError;

    const body = await req.json().catch(() => ({})) as { name?: string; school?: string; address?: string | null };
    const updates: { name?: string; school?: string; address?: string | null; updated_at?: string } = {};
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.school === 'string' && body.school.trim()) updates.school = body.school.trim();
    if (body.address !== undefined) updates.address = body.address === null || body.address === '' ? null : String(body.address).trim();
    updates.updated_at = new Date().toISOString();

    const hasChange = 'name' in updates || 'school' in updates || 'address' in updates;
    if (!hasChange) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const admin = createAdminClient(tenant.slug);
    const { data: facility, error } = await admin
      .from('facilities')
      .update(updates)
      .eq('id', id)
      .select('id, name, school, address, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!facility) return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    return NextResponse.json({ facility });
  } catch (e) {
    console.error('Admin PATCH facility error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug, req);
    if (authError) return authError;

    const admin = createAdminClient(tenant.slug);
    const { error } = await admin.from('facilities').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') return NextResponse.json({ error: 'Cannot delete: facility is in use by coaches or sessions.' }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin DELETE facility error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
