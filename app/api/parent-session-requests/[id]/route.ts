import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      action?: 'approve' | 'decline' | 'cancel';
      coachResponse?: string | null;
    };

    const action = body.action;
    if (!action || !['approve', 'decline', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve, decline, or cancel' }, { status: 400 });
    }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = userData?.role;

    const { data: row, error: fetchErr } = await supabase
      .from('parent_session_requests')
      .select(
        'id, status, requesting_parent_id, coach_id, youth_wrestler_id, message, athletes:coach_id(first_name, last_name)'
      )
      .eq('id', id)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const r = row as {
      status: string;
      requesting_parent_id: string;
      coach_id: string;
      youth_wrestler_id: string;
      message?: string | null;
      athletes?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
    };

    if (r.status !== 'pending') {
      return NextResponse.json({ error: 'This request is no longer pending' }, { status: 400 });
    }

    const coachResponse = body.coachResponse?.trim() || null;
    const respondedAt = new Date().toISOString();

    const admin = createAdminClient(tenant.slug);

    if (action === 'cancel') {
      if (role !== 'parent' && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (r.requesting_parent_id !== user.id && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error: upErr } = await admin
        .from('parent_session_requests')
        .update({
          status: 'cancelled',
          updated_at: respondedAt,
        })
        .eq('id', id)
        .eq('status', 'pending');

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'approve' || action === 'decline') {
      if (role !== 'coach' && role !== 'admin') {
        return NextResponse.json({ error: 'Only the coach can respond' }, { status: 403 });
      }
      if (r.coach_id !== user.id && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const newStatus = action === 'approve' ? 'approved' : 'declined';

      const { error: upErr } = await admin
        .from('parent_session_requests')
        .update({
          status: newStatus,
          coach_response: coachResponse,
          responded_at: respondedAt,
          updated_at: respondedAt,
        })
        .eq('id', id)
        .eq('status', 'pending');

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const coachName =
        r.athletes && !Array.isArray(r.athletes)
          ? [r.athletes.first_name, r.athletes.last_name].filter(Boolean).join(' ')
          : 'Coach';

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
      const link = `${baseUrl}/session-requests`;

      try {
        const title = action === 'approve' ? 'Session request approved' : 'Session request declined';
        const bodyText =
          action === 'approve'
            ? `${coachName} approved your session request.${coachResponse ? ` Note: ${coachResponse}` : ' Book a time from their profile or wait for them to reach out.'}`
            : `${coachName} declined your session request.${coachResponse ? ` Note: ${coachResponse}` : ''}`;

        await createNotification(admin, {
          user_id: r.requesting_parent_id,
          type: 'parent_session_request_response',
          title,
          body: bodyText,
          data: { requestId: id, link },
        });
      } catch (notifErr) {
        console.warn('parent session request response notification failed:', notifErr);
      }

      return NextResponse.json({ ok: true, status: newStatus });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('parent-session-requests PATCH:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
