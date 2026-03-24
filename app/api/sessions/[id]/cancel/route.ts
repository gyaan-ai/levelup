import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import { createNotification } from '@/lib/notifications';
import { differenceInHours } from 'date-fns';
import { formatEST } from '@/lib/format-date';
import { grantCredit } from '@/lib/credits';

const CANCELLATION_WINDOW_HOURS = 24;

export async function POST(
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

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isParent = userData?.role === 'parent';
    const isAdmin = userData?.role === 'admin';
    const isAthlete = userData?.role === 'coach';

    if (!isParent && !isAdmin && !isAthlete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = body.reason || 'Cancelled by user';

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: fetchError } = await admin
      .from('sessions')
      .select('*, athletes(id, first_name, last_name)')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isOwner = session.parent_id === user.id;
    const isCoach = session.athlete_id === user.id;

    if (!isOwner && !isCoach && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to cancel this session' }, { status: 403 });
    }

    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Session already cancelled' }, { status: 400 });
    }

    if (!['scheduled', 'pending_payment'].includes(session.status)) {
      return NextResponse.json({ error: 'Session cannot be cancelled' }, { status: 400 });
    }

    // Get session participants to grant credits
    const { data: participants } = await admin
      .from('session_participants')
      .select('id, parent_id, youth_wrestler_id, amount_paid')
      .eq('session_id', sessionId);

    const scheduledTime = new Date(session.scheduled_datetime);
    const hoursUntilSession = differenceInHours(scheduledTime, new Date());
    const withinRefundWindow = hoursUntilSession >= CANCELLATION_WINDOW_HOURS;

    const sessionDate = formatEST(scheduledTime, 'EEE, MMM d');
    const coach = Array.isArray(session.athletes) ? session.athletes[0] : session.athletes;
    const coachName = coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') : 'Coach';

    let creditsGranted = 0;
    let totalCreditsAmount = 0;

    // Grant credits to all participants (coach/admin cancel always grants credits)
    if (isCoach || isAdmin) {
      for (const participant of participants ?? []) {
        const amountPaid = Number(participant.amount_paid ?? 0);
        if (amountPaid > 0 && participant.parent_id) {
          const result = await grantCredit({
            userId: participant.parent_id,
            amount: amountPaid,
            reason: `Cancelled: ${sessionDate} with ${coachName}. ${reason}`,
            sourceType: 'cancellation',
            sourceId: sessionId,
          });
          if (result.success) {
            creditsGranted++;
            totalCreditsAmount += amountPaid;
          }
        }
      }
    } else if (isOwner && withinRefundWindow) {
      // Parent self-cancel with 24+ hours notice - grant credit
      const amountPaid = Number(session.total_price || 0);
      if (amountPaid > 0) {
        const result = await grantCredit({
          userId: user.id,
          amount: amountPaid,
          reason: `Self-cancelled: ${sessionDate} with ${coachName}`,
          sourceType: 'cancellation',
          sourceId: sessionId,
        });
        if (result.success) {
          creditsGranted = 1;
          totalCreditsAmount = amountPaid;
        }
      }
    }
    // Parent self-cancel with less than 24 hours - no credit (existing behavior)

    const { error: updateError } = await admin
      .from('sessions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to cancel session:', updateError);
      return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 });
    }

    // Update participant statuses
    if (participants && participants.length > 0) {
      await admin
        .from('session_participants')
        .update({ status: 'cancelled' })
        .eq('session_id', sessionId);
    }

    const when = formatEST(new Date(session.scheduled_datetime), 'MMM d, h:mm a');
    try {
      // Notify participants
      for (const participant of participants ?? []) {
        if (participant.parent_id) {
          const creditMsg = totalCreditsAmount > 0 
            ? ` $${totalCreditsAmount.toFixed(2)} credit added to your account.`
            : '';
          await createNotification(admin, {
            user_id: participant.parent_id,
            type: 'session_cancelled',
            title: 'Session cancelled',
            body: `Session on ${when} with ${coachName} was cancelled.${creditMsg}`,
            data: { link: '/bookings', session_id: sessionId },
          });
        }
      }
      // Notify coach if not the one cancelling
      if (session.athlete_id !== user.id) {
        await createNotification(admin, {
          user_id: session.athlete_id,
          type: 'session_cancelled',
          title: 'Session cancelled',
          body: `Session on ${when} was cancelled.`,
          data: { link: '/athlete-dashboard', session_id: sessionId },
        });
      }
    } catch (notifErr) {
      console.warn('Notify cancel failed:', notifErr);
    }

    const message = totalCreditsAmount > 0
      ? `Session cancelled. $${totalCreditsAmount.toFixed(2)} credit issued to ${creditsGranted} participant(s).`
      : withinRefundWindow
        ? 'Session cancelled.'
        : 'Session cancelled. No credit (less than 24 hours notice).';

    return NextResponse.json({
      success: true,
      creditsGranted,
      totalCreditsAmount,
      message,
    });
  } catch (e) {
    console.error('Cancel session error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
