import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getSessionSmsPhonesForPersonalText } from '@/lib/session-group-sms';

/**
 * GET — coach (or admin): resolved phone numbers for this session so the coach can
 * paste into their own Messages app (two-way texting). Same auth as sms-recipients.
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = userData?.role;
    if (role !== 'coach' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: sessErr } = await admin
      .from('sessions')
      .select('id, athlete_id')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const athleteId = (session as { athlete_id?: string }).athlete_id;
    if (role !== 'admin' && athleteId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await getSessionSmsPhonesForPersonalText(admin, sessionId);
    return NextResponse.json(data);
  } catch (e) {
    console.error('sms-phones GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
