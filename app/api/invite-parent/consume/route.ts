import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { verifyInviteToken } from '@/lib/invite-parent-token';

/** POST - consume an invite token: link the current user to the youth wrestler. Body: { token }. */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { token?: string };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

    const payload = verifyInviteToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent') return NextResponse.json({ error: 'Only parent accounts can use this invite' }, { status: 403 });

    const { data: yw } = await supabase.from('youth_wrestlers').select('parent_id').eq('id', payload.youthWrestlerId).single();
    if (!yw) return NextResponse.json({ error: 'Youth wrestler not found' }, { status: 404 });
    if (yw.parent_id === user.id) return NextResponse.json({ error: 'You are already the primary parent' }, { status: 400 });

    const admin = createAdminClient(tenant.slug);
    const { error } = await admin.from('youth_wrestler_parents').insert({
      youth_wrestler_id: payload.youthWrestlerId,
      parent_id: user.id,
    });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ ok: true }); // already linked
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Invite consume error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
