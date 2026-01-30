import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { differenceInHours } from 'date-fns';

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
    const isAthlete = userData?.role === 'athlete';

    if (!isParent && !isAdmin && !isAthlete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = body.reason || 'Cancelled by user';

    // Fetch the session
    const admin = createAdminClient(tenant.slug);
    const { data: session, error: fetchError } = await admin
      .from('sessions')
      .select('*, athletes(id, first_name, last_name)')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check permissions
    const isOwner = session.parent_id === user.id;
    const isCoach = session.athlete_id === user.id;
    
    if (!isOwner && !isCoach && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to cancel this session' }, { status: 403 });
    }

    // Check if already cancelled
    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Session already cancelled' }, { status: 400 });
    }

    // Check if session is in a cancellable state
    if (!['scheduled', 'pending_payment'].includes(session.status)) {
      return NextResponse.json({ error: 'Session cannot be cancelled' }, { status: 400 });
    }

    // Check 24-hour window for parent cancellations (coaches/admins can cancel anytime)
    const scheduledTime = new Date(session.scheduled_datetime);
    const hoursUntilSession = differenceInHours(scheduledTime, new Date());
    const withinCancellationWindow = hoursUntilSession >= CANCELLATION_WINDOW_HOURS;

    // Determine if credit should be issued
    // - Parent cancels 24h+ out: credit issued
    // - Parent cancels <24h: no credit (unless admin overrides)
    // - Coach cancels: always issue credit to parent
    // - Admin cancels: always issue credit to parent
    const shouldIssueCredit = 
      (isCoach || isAdmin) || // Coach or admin cancelling
      (isParent && withinCancellationWindow && session.status === 'scheduled'); // Parent within window and paid

    let creditId: string | null = null;
    const creditAmount = Number(session.total_price || 0);

    if (shouldIssueCredit && creditAmount > 0) {
      // Create credit for the parent
      const source = isCoach ? 'coach_cancellation' : isAdmin ? 'admin_grant' : 'cancellation';
      
      const { data: credit, error: creditError } = await admin
        .from('credits')
        .insert({
          parent_id: session.parent_id,
          amount: creditAmount,
          remaining: creditAmount,
          source,
          source_session_id: sessionId,
          description: isCoach 
            ? `Credit from coach cancellation - ${session.athletes?.first_name} ${session.athletes?.last_name}`
            : `Credit from cancelled session`,
          expires_at: null, // Credits don't expire
        })
        .select('id')
        .single();

      if (creditError) {
        console.error('Failed to create credit:', creditError);
        // Continue with cancellation even if credit fails
      } else {
        creditId = credit?.id || null;
      }
    }

    // Update session status
    const { error: updateError } = await admin
      .from('sessions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason,
        ...(creditId && { credit_id: creditId }),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to cancel session:', updateError);
      return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 });
    }

    // TODO: Send notification to the other party (parent or coach)

    return NextResponse.json({
      success: true,
      creditIssued: shouldIssueCredit && creditAmount > 0,
      creditAmount: shouldIssueCredit ? creditAmount : 0,
      message: shouldIssueCredit && creditAmount > 0
        ? `Session cancelled. $${creditAmount.toFixed(2)} credit added to your account.`
        : withinCancellationWindow 
          ? 'Session cancelled.'
          : 'Session cancelled. No credit issued (less than 24 hours notice).',
    });
  } catch (e) {
    console.error('Cancel session error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
