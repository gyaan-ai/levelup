import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import { createNotification } from '@/lib/notifications';
import { differenceInHours } from 'date-fns';
import { formatEST } from '@/lib/format-date';

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

    // Rule: refund only with 24+ hours notice (parent, coach, or admin)
    const scheduledTime = new Date(session.scheduled_datetime);
    const hoursUntilSession = differenceInHours(scheduledTime, new Date());
    const withinRefundWindow = hoursUntilSession >= CANCELLATION_WINDOW_HOURS;

    const amountCents = Math.round(Number(session.total_price || 0) * 100);
    let refundIssued = false;

    if (
      withinRefundWindow &&
      amountCents > 0 &&
      session.stripe_payment_intent_id &&
      !(session as { refunded_at?: string | null }).refunded_at
    ) {
      try {
        const stripe = getStripeInstance(tenant.slug);
        await stripe.refunds.create({
          payment_intent: session.stripe_payment_intent_id,
          amount: amountCents,
          reason: 'requested_by_customer',
          metadata: { session_id: sessionId, app: 'the-guild' },
        });
        refundIssued = true;
      } catch (stripeErr) {
        console.error('Stripe refund error:', stripeErr);
        // Continue with cancellation; parent can contact support for refund
      }
    }

    const { error: updateError } = await admin
      .from('sessions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason,
        ...(refundIssued && { refunded_at: new Date().toISOString() }),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to cancel session:', updateError);
      return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 });
    }

    const when = formatEST(new Date(session.scheduled_datetime), 'MMM d, h:mm a');
    try {
      await createNotification(admin, {
        user_id: session.parent_id,
        type: 'session_cancelled',
        title: 'Session cancelled',
        body: `Session on ${when} was cancelled.`,
        data: { link: '/bookings', session_id: sessionId },
      });
      if (session.athlete_id !== session.parent_id) {
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

    const message = refundIssued
      ? `Session cancelled. Refund of $${Number(session.total_price || 0).toFixed(2)} will be processed.`
      : withinRefundWindow
        ? 'Session cancelled.'
        : 'Session cancelled. No refund (less than 24 hours notice).';

    return NextResponse.json({
      success: true,
      refundIssued,
      message,
    });
  } catch (e) {
    console.error('Cancel session error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
