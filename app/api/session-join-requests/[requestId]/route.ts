import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import { hasMinPhoneDigits } from '@/lib/phone';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { action: 'approve' | 'decline'; sessionId: string };
    const { action, sessionId } = body;
    if (!action || !sessionId) return NextResponse.json({ error: 'Missing action or sessionId' }, { status: 400 });

    const { data: session } = await supabase
      .from('sessions')
      .select('id, parent_id, athlete_id, current_participants, max_participants')
      .eq('id', sessionId)
      .single();
    const s = session as { parent_id?: string; athlete_id?: string } | null;
    const isParent = s?.parent_id === user.id;
    const isCoach = s?.athlete_id === user.id;
    if (!session || (!isParent && !isCoach)) {
      return NextResponse.json({ error: 'Session not found or not yours' }, { status: 404 });
    }

    const { data: joinRequest } = await supabase
      .from('session_join_requests')
      .select('id, session_id, requesting_parent_id, youth_wrestler_id, status, youth_wrestlers(first_name, last_name)')
      .eq('id', requestId)
      .eq('session_id', sessionId)
      .single();
    if (!joinRequest || (joinRequest as { status?: string }).status !== 'pending') {
      return NextResponse.json({ error: 'Request not found or already responded' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'declined';

    if (action === 'approve') {
      const ywId = (joinRequest as { youth_wrestler_id?: string }).youth_wrestler_id;
      if (ywId) {
        const adminCheck = createAdminClient(tenant.slug);
        const { data: ywRow } = await adminCheck.from('youth_wrestlers').select('phone').eq('id', ywId).maybeSingle();
        if (!hasMinPhoneDigits(ywRow?.phone)) {
          return NextResponse.json(
            { error: 'That athlete must have a cell number on their profile before they can join.' },
            { status: 400 }
          );
        }
      }

      const current = (session as { current_participants?: number }).current_participants ?? 1;
      const max = (session as { max_participants?: number }).max_participants ?? 2;
      if (current >= max) return NextResponse.json({ error: 'Session is full' }, { status: 400 });

      const { error: upErr } = await supabase.from('sessions').update({
        current_participants: current + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const { error: partErr } = await supabase.from('session_participants').insert({
        session_id: sessionId,
        youth_wrestler_id: (joinRequest as { youth_wrestler_id?: string }).youth_wrestler_id,
        parent_id: (joinRequest as { requesting_parent_id?: string }).requesting_parent_id,
        paid: false,
        amount_paid: null,
      });
      if (partErr) {
        await supabase.from('sessions').update({ current_participants: current }).eq('id', sessionId);
        return NextResponse.json({ error: partErr.message }, { status: 500 });
      }
    }

    const { error: reqErr } = await supabase
      .from('session_join_requests')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', requestId);
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    const requestingParentId = (joinRequest as { requesting_parent_id?: string }).requesting_parent_id;
    const coachId = (session as { athlete_id?: string }).athlete_id;
    const ywRel = (joinRequest as { youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }).youth_wrestlers;
    const ywObj = Array.isArray(ywRel) ? ywRel[0] : ywRel;
    const ywName = ywObj ? [ywObj.first_name, ywObj.last_name].filter(Boolean).join(' ') : 'A wrestler';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const bookingsLink = `${baseUrl}/bookings`;

    try {
      const admin = createAdminClient(tenant.slug);
      // Notify requesting parent (and their athlete/youth if they had an account – we notify the parent who requested)
      if (action === 'approve') {
        if (requestingParentId) {
          await createNotification(admin, {
            user_id: requestingParentId,
            type: 'session_join_approved',
            title: 'Join request approved',
            body: 'Your wrestler was approved to join the session. Check My Bookings for details.',
            data: { sessionId, link: bookingsLink },
          });
        }
        // Notify coach so they know a new participant was added
        if (coachId) {
          await createNotification(admin, {
            user_id: coachId,
            type: 'session_join_approved',
            title: 'New participant added to your session',
            body: `${ywName} was approved to join. Session roster updated.`,
            data: { sessionId, link: `${baseUrl}/sessions/${sessionId}/requests` },
          });
        }
      } else if (requestingParentId) {
        await createNotification(admin, {
          user_id: requestingParentId,
          type: 'session_join_declined',
          title: 'Join request declined',
          body: 'The session owner declined the join request for this session.',
          data: { sessionId, link: bookingsLink },
        });
      }
    } catch (notifErr) {
      console.warn('Join response notification failed:', notifErr);
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e) {
    console.error('Session join request PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
