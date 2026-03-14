import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/** POST - Admin grants early adopter (1 free private + 2 free small group spots) to a parent. Body: { parent_id: string } */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parentId = typeof body?.parent_id === 'string' ? body.parent_id.trim() : '';
    if (!parentId) return NextResponse.json({ error: 'parent_id is required' }, { status: 400 });

    const admin = createAdminClient(tenant.slug);

    const { data: targetUser } = await admin.from('users').select('id, role').eq('id', parentId).single();
    if (!targetUser || targetUser.role !== 'parent') {
      return NextResponse.json({ error: 'User not found or is not a parent' }, { status: 400 });
    }

    const { data: existing } = await admin
      .from('early_adopter_entitlements')
      .select('id')
      .eq('parent_id', parentId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'This parent already has early adopter entitlements' }, { status: 400 });
    }

    const { error: ent1 } = await admin.from('early_adopter_entitlements').insert({
      parent_id: parentId,
      session_type: '1-on-1',
      remaining: 1,
      discount_code: 'ADMIN_GRANT',
    });
    if (ent1) return NextResponse.json({ error: ent1.message }, { status: 500 });

    const { error: ent2 } = await admin.from('early_adopter_entitlements').insert({
      parent_id: parentId,
      session_type: '2-athlete',
      remaining: 2,
      discount_code: 'ADMIN_GRANT',
    });
    if (ent2) return NextResponse.json({ error: ent2.message }, { status: 500 });

    return NextResponse.json({ success: true, message: 'Early adopter benefits granted (1 free private + 2 free small group spots).' });
  } catch (e) {
    console.error('Admin grant early adopter error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
