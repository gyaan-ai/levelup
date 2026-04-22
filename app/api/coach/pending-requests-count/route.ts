import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/**
 * GET — pending join requests (invite-only sessions) for this coach.
 * Used for Schedule tab badge on mobile bottom nav.
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
    const role = userData?.role;
    if (role !== 'coach' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const viewAsCoachId = role === 'admin' ? cookieStore.get('levelup_view_as_coach_id')?.value : null;
    const coachId = viewAsCoachId || user.id;

    const { count: joinCount } = await supabase
      .from('session_join_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const join = joinCount ?? 0;
    return NextResponse.json({ join, slot: 0, total: join });
  } catch (e) {
    console.error('pending-requests-count GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
