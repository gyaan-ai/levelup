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
  return { user };
}

/** POST - Link the current user (admin) as a parent to this youth wrestler. They will see the wrestler in their parent dashboard / My Wrestlers. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: youthWrestlerId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await requireAdmin(tenant.slug);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const admin = createAdminClient(tenant.slug);
    const { data: yw, error: ywErr } = await admin
      .from('youth_wrestlers')
      .select('id, parent_id')
      .eq('id', youthWrestlerId)
      .single();

    if (ywErr || !yw) return NextResponse.json({ error: 'Youth wrestler not found' }, { status: 404 });
    if (yw.parent_id === user.id) {
      return NextResponse.json({ success: true, alreadyPrimary: true, message: 'You are already the primary parent.' });
    }

    const { error: linkErr } = await admin.from('youth_wrestler_parents').insert({
      youth_wrestler_id: youthWrestlerId,
      parent_id: user.id,
    });

    if (linkErr) {
      if (linkErr.code === '23505') {
        return NextResponse.json({ success: true, alreadyLinked: true, message: 'Already linked to your account.' });
      }
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Linked to your account. View as Parent to see them in My Wrestlers.' });
  } catch (e) {
    console.error('Admin link-parent error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
