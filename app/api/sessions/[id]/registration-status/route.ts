import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { getParentYouthWrestlerIds } from '@/lib/parent-wrestlers';

/**
 * GET — is the current parent’s family enrolled in this session? (for post-Stripe UI polling)
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ enrolled: false, needAuth: true });

    const youthIds = await getParentYouthWrestlerIds(supabase, user.id);
    if (youthIds.length === 0) return NextResponse.json({ enrolled: false });

    const { data } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .in('youth_wrestler_id', youthIds)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ enrolled: !!data });
  } catch (e) {
    console.error('registration-status GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
