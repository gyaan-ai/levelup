import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { fetchCoachRosterData } from '@/lib/coach-roster';

/**
 * GET — coach (or admin preview): deduped families/kids from all sessions with this coach,
 * with resolved phone numbers for texting.
 */
export async function GET() {
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
    if (userData?.role !== 'coach' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const viewAsCoachId =
      userData?.role === 'admin' ? cookieStore.get('levelup_view_as_coach_id')?.value : null;
    const coachId = viewAsCoachId || user.id;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);

    const admin = createAdminClient(tenant.slug);
    const { entries, nextSession } = await fetchCoachRosterData(admin, coachId, baseUrl);

    return NextResponse.json({ entries, nextSession });
  } catch (e) {
    console.error('coach roster GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
