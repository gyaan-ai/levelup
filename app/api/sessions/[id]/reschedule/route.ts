import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as { scheduledDate: string; scheduledTime: string };
    const { scheduledDate, scheduledTime } = body;

    if (!scheduledDate || !scheduledTime) {
      return NextResponse.json(
        { error: 'scheduledDate and scheduledTime are required' },
        { status: 400 }
      );
    }

    const [datePart] = scheduledDate.split('T');
    const scheduledDatetime = `${datePart}T${scheduledTime}`;
    const dt = new Date(scheduledDatetime);
    if (Number.isNaN(dt.getTime())) {
      return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 });
    }

    if (dt <= new Date()) {
      return NextResponse.json(
        { error: 'New date/time must be in the future' },
        { status: 400 }
      );
    }

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: fetchError } = await admin
      .from('sessions')
      .select('id, parent_id, athlete_id, status')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.parent_id !== user.id) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      const isAdmin = userData?.role === 'admin';
      const isCoach = session.athlete_id === user.id;
      if (!isAdmin && !isCoach) {
        return NextResponse.json(
          { error: 'Not authorized to reschedule this session' },
          { status: 403 }
        );
      }
    }

    if (!['scheduled', 'pending_payment'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Only scheduled or pending sessions can be rescheduled' },
        { status: 400 }
      );
    }

    const { error: updateError } = await admin
      .from('sessions')
      .update({ scheduled_datetime: scheduledDatetime })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Reschedule error:', updateError);
      return NextResponse.json(
        { error: 'Failed to reschedule session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session rescheduled successfully',
    });
  } catch (e) {
    console.error('Reschedule session error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
