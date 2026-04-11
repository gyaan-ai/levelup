import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getCoachAllTimeAthletePhonesForPersonalText } from '@/lib/session-group-sms';

/**
 * GET — coach: distinct athlete cell numbers for every youth who has ever been on
 * `session_participants` for any session run by this coach (newline-separated for Messages).
 */
export async function GET(_req: NextRequest) {
  try {
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
    const data = await getCoachAllTimeAthletePhonesForPersonalText(admin, user.id);
    return NextResponse.json(data);
  } catch (e) {
    console.error('all-session-athlete-phones GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
