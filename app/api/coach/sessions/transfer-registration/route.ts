import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { transferSessionRegistration } from '@/lib/transfer-session-registration';

/**
 * Coach-only: transfer a participant between two sessions they coach.
 * Admins should use /api/admin/sessions/transfer-registration.
 */
export async function POST(req: NextRequest) {
  try {
    const hdrs = await headers();
    const host = hdrs.get('host') ?? '';
    const tenant = getTenantByDomain(host);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const supabase = await createClient(tenant.slug);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'coach' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const viewAsCoachId =
      userData?.role === 'admin' ? cookieStore.get('levelup_view_as_coach_id')?.value : null;
    const effectiveCoachId = viewAsCoachId || user.id;

    const { participantId, fromSessionId, toSessionId } = await req.json();

    const admin = createAdminClient(tenant.slug);

    const { data: fromS } = await admin
      .from('sessions')
      .select('id, athlete_id')
      .eq('id', fromSessionId)
      .maybeSingle();
    const { data: toS } = await admin
      .from('sessions')
      .select('id, athlete_id')
      .eq('id', toSessionId)
      .maybeSingle();

    if (!fromS || !toS) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (fromS.athlete_id !== effectiveCoachId || toS.athlete_id !== effectiveCoachId) {
      return NextResponse.json(
        { error: 'You can only transfer between your own sessions' },
        { status: 403 }
      );
    }

    const result = await transferSessionRegistration(admin, {
      participantId,
      fromSessionId,
      toSessionId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Registration transferred successfully',
      participantId: result.participantId,
      fromSessionId: result.fromSessionId,
      toSessionId: result.toSessionId,
      amountPaid: result.amountPaid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
