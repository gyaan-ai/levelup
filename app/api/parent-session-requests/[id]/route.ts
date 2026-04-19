import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import {
  createSessionFromParentRequest,
  formatSessionWhenForNotification,
  paymentDeadlineIso,
  type RequestSessionKind,
} from '@/lib/create-session-from-parent-request';

type RequestRow = {
  id: string;
  status: string;
  requesting_parent_id: string;
  coach_id: string;
  youth_wrestler_id: string;
  facility_id: string | null;
  preferred_datetime: string | null;
  session_type: string | null;
  duration_minutes?: number | null;
  message?: string | null;
  counter_preferred_datetime?: string | null;
  counter_note?: string | null;
  athletes?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
};

function coachNameFromRow(r: RequestRow): string {
  const a = r.athletes;
  if (a && !Array.isArray(a)) {
    return [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || 'Coach';
  }
  return 'Coach';
}

function sessionKindFromRequest(st: string | null | undefined): RequestSessionKind | null {
  if (st === 'private' || st === '1-on-1') return 'private';
  if (st === 'partner' || st === '2-athlete' || st === 'partner-invite') return 'partner';
  return null;
}

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
      action?: 'approve' | 'decline' | 'cancel' | 'counter' | 'accept_counter' | 'decline_counter';
      coachResponse?: string | null;
      counterPreferredDatetime?: string | null;
      counterNote?: string | null;
    };

    const action = body.action;
    if (
      !action ||
      !['approve', 'decline', 'cancel', 'counter', 'accept_counter', 'decline_counter'].includes(action)
    ) {
      return NextResponse.json(
        { error: 'action must be approve, decline, cancel, counter, accept_counter, or decline_counter' },
        { status: 400 }
      );
    }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = userData?.role;

    const { data: row, error: fetchErr } = await supabase
      .from('parent_session_requests')
      .select(
        `
        id,
        status,
        requesting_parent_id,
        coach_id,
        youth_wrestler_id,
        facility_id,
        preferred_datetime,
        session_type,
        duration_minutes,
        message,
        counter_preferred_datetime,
        counter_note,
        athletes:coach_id(first_name, last_name)
      `
      )
      .eq('id', id)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const r = row as RequestRow;
    const coachResponse = body.coachResponse?.trim() || null;
    const respondedAt = new Date().toISOString();
    const admin = createAdminClient(tenant.slug);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);

    if (action === 'cancel') {
      if (role !== 'parent' && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (r.requesting_parent_id !== user.id && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (r.status !== 'pending' && r.status !== 'countered') {
        return NextResponse.json({ error: 'This request cannot be cancelled' }, { status: 400 });
      }

      const { error: upErr } = await admin
        .from('parent_session_requests')
        .update({
          status: 'cancelled',
          updated_at: respondedAt,
        })
        .eq('id', id)
        .in('status', ['pending', 'countered']);

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'decline_counter' || action === 'accept_counter') {
      if (role !== 'parent' && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (r.requesting_parent_id !== user.id && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (r.status !== 'countered') {
        return NextResponse.json({ error: 'No counter to respond to' }, { status: 400 });
      }

      if (action === 'decline_counter') {
        const { error: upErr } = await admin
          .from('parent_session_requests')
          .update({
            status: 'declined',
            coach_response: coachResponse,
            responded_at: respondedAt,
            updated_at: respondedAt,
          })
          .eq('id', id)
          .eq('status', 'countered');

        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

        const cname = coachNameFromRow(r);
        try {
          await createNotification(admin, {
            user_id: r.coach_id,
            type: 'parent_session_request_response',
            title: 'Counter declined',
            body: `The family declined your proposed time.${coachResponse ? ` Note: ${coachResponse}` : ''}`,
            data: { requestId: id, link: `${baseUrl}/athlete-dashboard` },
            coachId: r.coach_id,
          });
        } catch (notifErr) {
          console.warn('counter decline coach notify:', notifErr);
        }

        return NextResponse.json({ ok: true, status: 'declined' });
      }

      const counterIso = r.counter_preferred_datetime;
      if (!counterIso) {
        return NextResponse.json({ error: 'Missing counter time' }, { status: 400 });
      }
      const kind = sessionKindFromRequest(r.session_type);
      if (!kind) {
        return NextResponse.json({ error: 'Session type must be private or partner for approval' }, { status: 400 });
      }

      const created = await createSessionFromParentRequest(admin, {
        parentId: r.requesting_parent_id,
        coachId: r.coach_id,
        youthWrestlerId: r.youth_wrestler_id,
        facilityId: r.facility_id,
        scheduledDatetimeIso: counterIso,
        sessionKind: kind,
        durationMinutes: r.duration_minutes ?? 60,
        tenantPricing: tenant.pricing,
      });

      if (!created.ok) {
        return NextResponse.json({ error: created.error }, { status: created.status ?? 500 });
      }

      const deadline = paymentDeadlineIso(24);
      const { error: upErr } = await admin
        .from('parent_session_requests')
        .update({
          status: 'approved',
          created_session_id: created.sessionId,
          payment_deadline_at: deadline,
          responded_at: respondedAt,
          updated_at: respondedAt,
        })
        .eq('id', id)
        .eq('status', 'countered');

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const cname = coachNameFromRow(r);
      const when = formatSessionWhenForNotification(counterIso);
      try {
        await createNotification(admin, {
          user_id: r.requesting_parent_id,
          type: 'parent_session_request_response',
          title: 'Complete your booking',
          body: `${cname} confirmed ${when}. Finish checkout within 24 hours.`,
          data: {
            requestId: id,
            link: `${baseUrl}/cart/checkout`,
            sessionId: created.sessionId,
          },
        });
        await createNotification(admin, {
          user_id: r.coach_id,
          type: 'parent_session_request_response',
          title: 'Counter accepted',
          body: `The family accepted your time — ${when}.`,
          data: { requestId: id, link: `${baseUrl}/athlete-dashboard` },
          coachId: r.coach_id,
        });
      } catch (notifErr) {
        console.warn('accept counter notify:', notifErr);
      }

      return NextResponse.json({ ok: true, status: 'approved', sessionId: created.sessionId });
    }

    if (action === 'counter') {
      if (role !== 'coach' && role !== 'admin') {
        return NextResponse.json({ error: 'Only the coach can counter' }, { status: 403 });
      }
      if (r.coach_id !== user.id && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (r.status !== 'pending') {
        return NextResponse.json({ error: 'Can only counter pending requests' }, { status: 400 });
      }
      const counterDt = body.counterPreferredDatetime?.trim();
      if (!counterDt) {
        return NextResponse.json({ error: 'counterPreferredDatetime required' }, { status: 400 });
      }
      const d = new Date(counterDt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid counterPreferredDatetime' }, { status: 400 });
      }

      const { error: upErr } = await admin
        .from('parent_session_requests')
        .update({
          status: 'countered',
          counter_preferred_datetime: d.toISOString(),
          counter_note: body.counterNote?.trim() || null,
          updated_at: respondedAt,
        })
        .eq('id', id)
        .eq('status', 'pending');

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const cname = coachNameFromRow(r);
      const when = formatSessionWhenForNotification(d.toISOString());
      try {
        await createNotification(admin, {
          user_id: r.requesting_parent_id,
          type: 'parent_session_request_response',
          title: 'New time proposed',
          body: `${cname} proposed ${when}. Open Session requests to accept or decline.`,
          data: { requestId: id, link: `${baseUrl}/session-requests` },
        });
      } catch (notifErr) {
        console.warn('counter parent notify:', notifErr);
      }

      return NextResponse.json({ ok: true, status: 'countered' });
    }

    if (action === 'approve' || action === 'decline') {
      if (role !== 'coach' && role !== 'admin') {
        return NextResponse.json({ error: 'Only the coach can respond' }, { status: 403 });
      }
      if (r.coach_id !== user.id && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (r.status !== 'pending') {
        return NextResponse.json({ error: 'This request is no longer pending' }, { status: 400 });
      }

      if (action === 'decline') {
        const { error: upErr } = await admin
          .from('parent_session_requests')
          .update({
            status: 'declined',
            coach_response: coachResponse,
            responded_at: respondedAt,
            updated_at: respondedAt,
          })
          .eq('id', id)
          .eq('status', 'pending');

        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

        const cname = coachNameFromRow(r);
        try {
          await createNotification(admin, {
            user_id: r.requesting_parent_id,
            type: 'parent_session_request_response',
            title: 'Session request update',
            body: `${cname} couldn't confirm that time.${coachResponse ? ` ${coachResponse}` : ' Try another slot or message the coach.'}`,
            data: { requestId: id, link: `${baseUrl}/session-requests` },
          });
        } catch (notifErr) {
          console.warn('decline notify:', notifErr);
        }

        return NextResponse.json({ ok: true, status: 'declined' });
      }

      const pref = r.preferred_datetime;
      if (!pref) {
        return NextResponse.json(
          { error: 'Request has no preferred time — ask the parent to pick a slot or use Counter.' },
          { status: 400 }
        );
      }
      const kind = sessionKindFromRequest(r.session_type);
      if (!kind) {
        return NextResponse.json(
          { error: 'Approve only supports private or partner requests. Use a different flow for group.' },
          { status: 400 }
        );
      }

      const created = await createSessionFromParentRequest(admin, {
        parentId: r.requesting_parent_id,
        coachId: r.coach_id,
        youthWrestlerId: r.youth_wrestler_id,
        facilityId: r.facility_id,
        scheduledDatetimeIso: pref,
        sessionKind: kind,
        durationMinutes: r.duration_minutes ?? 60,
        tenantPricing: tenant.pricing,
      });

      if (!created.ok) {
        return NextResponse.json({ error: created.error }, { status: created.status ?? 500 });
      }

      const deadline = paymentDeadlineIso(24);
      const { error: upErr } = await admin
        .from('parent_session_requests')
        .update({
          status: 'approved',
          coach_response: coachResponse,
          created_session_id: created.sessionId,
          payment_deadline_at: deadline,
          responded_at: respondedAt,
          updated_at: respondedAt,
        })
        .eq('id', id)
        .eq('status', 'pending');

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const cname = coachNameFromRow(r);
      const when = formatSessionWhenForNotification(pref);
      try {
        await createNotification(admin, {
          user_id: r.requesting_parent_id,
          type: 'parent_session_request_response',
          title: 'Session approved — complete booking',
          body: `${cname} approved ${when}. Checkout within 24 hours to hold your spot.`,
          data: {
            requestId: id,
            link: `${baseUrl}/cart/checkout`,
            sessionId: created.sessionId,
          },
        });
      } catch (notifErr) {
        console.warn('approve notify:', notifErr);
      }

      return NextResponse.json({ ok: true, status: 'approved', sessionId: created.sessionId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('parent-session-requests PATCH:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
