import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantFromRequestHeaders } from '@/config/tenants';
import { easternWallDateTimeToUtcIso, formatEST } from '@/lib/format-date';
import { COACH_SESSION_OVERLAP_ERROR, findCoachSessionTimeOverlap } from '@/lib/coach-session-overlap';
import { createNotification } from '@/lib/notifications';
import { sendParentsSessionRescheduleSms } from '@/lib/twilio';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const tenant = getTenantFromRequestHeaders(headersList);

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

    const scheduledDatetime = easternWallDateTimeToUtcIso(scheduledDate, scheduledTime);
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
      .select(
        `
        id,
        parent_id,
        athlete_id,
        status,
        duration_minutes,
        scheduled_datetime,
        athletes ( first_name, last_name )
      `
      )
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

    if (session.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Only scheduled or pending sessions can be rescheduled' },
        { status: 400 }
      );
    }

    try {
      const conflict = await findCoachSessionTimeOverlap(admin, {
        coachAthleteId: session.athlete_id,
        scheduledStartIso: scheduledDatetime,
        durationMinutes: session.duration_minutes,
        excludeSessionId: sessionId,
      });
      if (conflict) {
        return NextResponse.json({ error: COACH_SESSION_OVERLAP_ERROR }, { status: 409 });
      }
    } catch (overlapErr) {
      console.error('[reschedule] coach overlap check', overlapErr);
      return NextResponse.json({ error: 'Could not verify schedule availability' }, { status: 500 });
    }

    const previousIso = session.scheduled_datetime as string;
    const { error: updateError } = await admin
      .from('sessions')
      .update({ scheduled_datetime: scheduledDatetime, updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Reschedule error:', updateError);
      return NextResponse.json(
        { error: 'Failed to reschedule session' },
        { status: 500 }
      );
    }

    if (previousIso !== scheduledDatetime) {
      const oldWhen = formatEST(new Date(previousIso), 'EEE, MMM d, h:mm a');
      const newWhen = formatEST(new Date(scheduledDatetime), 'EEE, MMM d, h:mm a');
      const coachRow = session.athletes as
        | { first_name?: string | null; last_name?: string | null }
        | { first_name?: string | null; last_name?: string | null }[]
        | null;
      const coachOne = Array.isArray(coachRow) ? coachRow[0] : coachRow;
      const coachName = coachOne
        ? [coachOne.first_name, coachOne.last_name].filter(Boolean).join(' ').trim() || 'Coach'
        : 'Coach';

      const { data: participants } = await admin
        .from('session_participants')
        .select('parent_id')
        .eq('session_id', sessionId);
      const parentIdsToNotify = new Set<string>();
      for (const row of participants ?? []) {
        const pid = (row as { parent_id?: string | null }).parent_id;
        if (pid) parentIdsToNotify.add(pid);
      }
      if (parentIdsToNotify.size === 0 && session.parent_id) {
        parentIdsToNotify.add(session.parent_id as string);
      }

      try {
        for (const parentId of parentIdsToNotify) {
          if (parentId === user.id) continue;
          await createNotification(admin, {
            user_id: parentId,
            type: 'session_rescheduled',
            title: 'Session rescheduled',
            body: `Your session with ${coachName} was moved from ${oldWhen} to ${newWhen}.`,
            data: { link: '/bookings', session_id: sessionId },
            sessionId,
          });
        }
      } catch (notifErr) {
        console.warn('[reschedule] in-app notify parents failed:', notifErr);
      }

      try {
        await sendParentsSessionRescheduleSms(admin, {
          sessionId,
          coachAthleteId: session.athlete_id as string,
          coachName,
          oldWhen,
          newWhen,
          excludeUserId: user.id,
          fallbackParentId: (session.parent_id as string | null) ?? null,
        });
      } catch (smsErr) {
        console.warn('[reschedule] parent SMS failed:', smsErr);
      }
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
