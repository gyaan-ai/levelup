import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/**
 * DELETE /api/athletes/[id]
 * Delete athlete (coach) profile. Allowed for: admin, parent, or the athlete themselves.
 */
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

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = userData?.role ?? null;
    const isAdmin = role === 'admin';
    const isParent = role === 'parent';
    const isOwnProfile = user.id === id && role === 'coach';

    if (!isAdmin && !isParent && !isOwnProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: athlete } = await admin.from('athletes').select('id').eq('id', id).single();
    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    await admin.from('coach_follows').delete().eq('coach_id', id);
    const { error: delError } = await admin.from('athletes').delete().eq('id', id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    await admin.from('users').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE athlete error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
