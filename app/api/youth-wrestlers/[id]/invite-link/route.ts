import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { createInviteToken } from '@/lib/invite-parent-token';

/** GET - generate an invite link for this youth wrestler (primary parent only). Query: expiresInDays (optional, default 7). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: youthWrestlerId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: yw } = await supabase.from('youth_wrestlers').select('parent_id').eq('id', youthWrestlerId).single();
    if (!yw || yw.parent_id !== user.id) {
      return NextResponse.json({ error: 'Only the primary parent can create an invite link' }, { status: 403 });
    }

    const expiresInDays = Math.min(30, Math.max(1, parseInt(req.nextUrl.searchParams.get('expiresInDays') || '7', 10) || 7));
    let token: string;
    try {
      token = createInviteToken(youthWrestlerId, expiresInDays);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invite links are not configured. Set PARENT_INVITE_SECRET in environment.' },
        { status: 503 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const url = `${baseUrl}/invite-parent?token=${encodeURIComponent(token)}`;

    return NextResponse.json({ url, expiresInDays });
  } catch (e) {
    console.error('Invite link error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
