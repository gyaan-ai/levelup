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

// PATCH approve or reject. Body: { action: 'approve' | 'reject' }
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

    const body = await req.json().catch(() => ({})) as { action?: string };
    const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : null;
    if (!action) return NextResponse.json({ error: 'Body must include action: "approve" or "reject"' }, { status: 400 });

    const admin = createAdminClient(tenant.slug);
    const { data: request, error: fetchErr } = await admin
      .from('facility_requests')
      .select('id, requested_by_athlete_id, name, school, address, status')
      .eq('id', id)
      .single();

    if (fetchErr || !request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (request.status !== 'pending') return NextResponse.json({ error: 'Request already resolved' }, { status: 409 });

    const now = new Date().toISOString();

    if (action === 'reject') {
      const { error: updateErr } = await admin
        .from('facility_requests')
        .update({ status: 'rejected', resolved_at: now })
        .eq('id', id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    // Approve: create facility, assign to coach, update request
    const { data: facility, error: insertErr } = await admin
      .from('facilities')
      .insert({
        name: request.name,
        school: request.school,
        address: request.address || null,
      })
      .select('id, name, school')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') return NextResponse.json({ error: 'A facility with this name and school already exists.' }, { status: 409 });
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await admin
      .from('athletes')
      .update({ facility_id: facility.id, updated_at: now })
      .eq('id', request.requested_by_athlete_id);

    const { error: updateErr } = await admin
      .from('facility_requests')
      .update({
        status: 'approved',
        resolved_at: now,
        resolved_facility_id: facility.id,
      })
      .eq('id', id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'approved', facility });
  } catch (e) {
    console.error('Admin facility-request PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
