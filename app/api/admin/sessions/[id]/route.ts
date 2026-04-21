import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { easternWallDateTimeToUtcIso } from '@/lib/format-date';
import { notifySessionScheduledFollowers } from '@/lib/notify-session-scheduled-followers';
import { COACH_SESSION_OVERLAP_ERROR, findCoachSessionTimeOverlap } from '@/lib/coach-session-overlap';

/**
 * PATCH - Admin updates a session (focus_area, join_policy, max_participants, price_per_participant).
 * Only allowed for scheduled or pending_payment sessions.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';
    const isCoach = userData?.role === 'coach';
    if (!isAdmin && !isCoach) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: {
      session_type?: 'small_group' | 'partner' | 'private';
      focus_area?: string | null;
      focus_area_2?: string | null;
      join_policy?: 'public' | 'private' | 'invite_only';
      max_participants?: number;
      price_per_participant?: number;
      scheduledDate?: string;
      scheduledTime?: string;
      published?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);

    const { data: session, error: fetchErr } = await admin
      .from('sessions')
      .select('id, status, session_type, athlete_id, scheduled_datetime, partner_invite_code, duration_minutes')
      .eq('id', sessionId)
      .single();
    
    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const coachOwnsSession = isCoach && session.athlete_id === user.id;
    if (!isAdmin && !coachOwnsSession) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Allow admin or owning coach to edit any session that isn't cancelled
    if (session.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cancelled sessions cannot be edited' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.session_type !== undefined && ['small_group', 'partner', 'private'].includes(body.session_type)) {
      // Map UI values to DB constraint values: '1-on-1', '2-athlete', 'group'
      updates.session_type = body.session_type === 'small_group' ? 'group' : body.session_type === 'partner' ? '2-athlete' : '1-on-1';
      // Also update session_mode based on type
      updates.session_mode = body.session_type === 'private' ? 'private' : 'partner-invite';
    }
    if (body.focus_area !== undefined) {
      updates.focus_area = body.focus_area === '' || body.focus_area == null
        ? null
        : String(body.focus_area).trim() || null;
    }
    if (body.focus_area_2 !== undefined) {
      updates.focus_area_2 = body.focus_area_2 === '' || body.focus_area_2 == null
        ? null
        : String(body.focus_area_2).trim() || null;
    }
    if (body.join_policy !== undefined) {
      if (['public', 'private', 'invite_only'].includes(body.join_policy)) {
        updates.join_policy = body.join_policy;
      }
    }
    if (body.max_participants !== undefined) {
      let max = Math.min(20, Math.max(1, Number(body.max_participants) || 2));
      const effectiveType =
        body.session_type !== undefined
          ? body.session_type === 'small_group'
            ? 'group'
            : body.session_type === 'partner'
              ? '2-athlete'
              : '1-on-1'
          : session.session_type;
      if (effectiveType === '2-athlete') {
        max = 2;
      }
      updates.max_participants = max;
    }
    if (body.session_type === 'partner') {
      updates.max_participants = 2;
    }
    if (body.price_per_participant !== undefined) {
      const price = Math.max(0, Number(body.price_per_participant) ?? 0);
      updates.price_per_participant = price;
    }
    if (body.scheduledDate && body.scheduledTime) {
      const newIso = easternWallDateTimeToUtcIso(body.scheduledDate, body.scheduledTime);
      try {
        const conflict = await findCoachSessionTimeOverlap(admin, {
          coachAthleteId: session.athlete_id,
          scheduledStartIso: newIso,
          durationMinutes: session.duration_minutes,
          excludeSessionId: sessionId,
        });
        if (conflict) {
          return NextResponse.json({ error: COACH_SESSION_OVERLAP_ERROR }, { status: 409 });
        }
      } catch (overlapErr) {
        console.error('[admin session PATCH] coach overlap check', overlapErr);
        return NextResponse.json({ error: 'Could not verify schedule availability' }, { status: 500 });
      }
      updates.scheduled_datetime = newIso;
    }
    
    // published column doesn't exist in DB - skip this logic
    const isNewlyPublished = false;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('sessions')
      .update(updates)
      .eq('id', sessionId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    
    // If session was just published, notify followers
    if (isNewlyPublished && session.athlete_id && session.partner_invite_code) {
      void notifySessionScheduledFollowers(tenant.slug, session.athlete_id, {
        sessionId,
        scheduledDatetime: (updates.scheduled_datetime as string) || session.scheduled_datetime,
        joinUrlPath: `/join/${session.partner_invite_code}`,
      });
    }
    
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Admin session PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Admin permanently deletes a session.
 * Only allowed for scheduled or pending_payment. Session participants are removed (CASCADE).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';
    const isCoach = userData?.role === 'coach';
    if (!isAdmin && !isCoach) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: fetchErr } = await admin
      .from('sessions')
      .select('id, status, athlete_id, current_participants')
      .eq('id', sessionId)
      .single();

    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const coachOwnsSession = isCoach && session.athlete_id === user.id;
    if (!isAdmin && !coachOwnsSession) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'scheduled' && session.status !== 'pending_payment') {
      return NextResponse.json(
        { error: 'Only scheduled or pending-payment sessions can be deleted' },
        { status: 400 }
      );
    }

    if (!isAdmin) {
      if ((session.current_participants ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              'This session has registrations. Cancel it from your session list instead of deleting.',
          },
          { status: 400 }
        );
      }
      const { count, error: cntErr } = await admin
        .from('session_participants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId);
      if (cntErr) {
        return NextResponse.json({ error: 'Could not verify participants' }, { status: 500 });
      }
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              'This session has registrations. Cancel it from your session list instead of deleting.',
          },
          { status: 400 }
        );
      }
    }

    const { error: deleteErr } = await admin.from('sessions').delete().eq('id', sessionId);
    if (deleteErr) {
      console.error('Admin session DELETE error:', deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Admin session DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
