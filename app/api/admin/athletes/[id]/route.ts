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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug);
    if (authError) return authError;

    const admin = createAdminClient(tenant.slug);
    const { data: athlete, error } = await admin
      .from('athletes')
      .select('id, first_name, last_name, school, facility_id, active, weight_class, bio, photo_url')
      .eq('id', id)
      .single();

    if (error || !athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    return NextResponse.json({ athlete });
  } catch (e) {
    console.error('Admin GET athlete error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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

    const authError = await requireAdmin(tenant.slug);
    if (authError) return authError;

    const body = await req.json().catch(() => ({})) as {
      active?: boolean;
      first_name?: string;
      last_name?: string;
      school?: string;
      facility_id?: string | null;
    };
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.active === 'boolean') updates.active = body.active;
    if (typeof body.first_name === 'string' && body.first_name.trim()) updates.first_name = body.first_name.trim();
    if (typeof body.last_name === 'string' && body.last_name.trim()) updates.last_name = body.last_name.trim();
    if (typeof body.school === 'string' && body.school.trim()) updates.school = body.school.trim();
    if (body.facility_id !== undefined) updates.facility_id = body.facility_id === null || body.facility_id === '' ? null : body.facility_id;

    const admin = createAdminClient(tenant.slug);
    const { data: athlete, error } = await admin
      .from('athletes')
      .update(updates)
      .eq('id', id)
      .select('id, first_name, last_name, school, facility_id, active')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    return NextResponse.json({ athlete });
  } catch (e) {
    console.error('Admin PATCH athlete error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug);
    if (authError) return authError;

    const admin = createAdminClient(tenant.slug);

    const { data: athlete } = await admin.from('athletes').select('id').eq('id', id).single();
    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    await admin.from('coach_follows').delete().eq('coach_id', id);
    const { error: delError } = await admin.from('athletes').delete().eq('id', id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    await admin.from('users').delete().eq('id', id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Admin DELETE athlete error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
