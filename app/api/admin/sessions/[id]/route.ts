import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { fromZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { APP_TIMEZONE } from '@/lib/format-date';

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
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as {
      session_type?: 'small_group' | 'partner' | 'private';
      focus_area?: string | null;
      focus_area_2?: string | null;
      join_policy?: 'public' | 'private' | 'invite_only';
      max_participants?: number;
      price_per_participant?: number;
      scheduledDate?: string;
      scheduledTime?: string;
    };

    const admin = createAdminClient(tenant.slug);

    const { data: session, error: fetchErr } = await admin
      .from('sessions')
      .select('id, status, session_type')
      .eq('id', sessionId)
      .single();

    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'scheduled' && session.status !== 'pending_payment') {
      return NextResponse.json(
        { error: 'Only scheduled or pending-payment sessions can be edited' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.session_type !== undefined && ['small_group', 'partner', 'private'].includes(body.session_type)) {
      updates.session_type = body.session_type;
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
      const max = Math.min(20, Math.max(1, Number(body.max_participants) || 2));
      updates.max_participants = max;
    }
    if (body.price_per_participant !== undefined) {
      const price = Math.max(0, Number(body.price_per_participant) ?? 0);
      updates.price_per_participant = price;
    }
    if (body.scheduledDate && body.scheduledTime) {
      const [datePart] = body.scheduledDate.split('T');
      const timePart = body.scheduledTime.includes(':') ? body.scheduledTime : `${body.scheduledTime}:00`;
      const localIso = `${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
      const utcDate = fromZonedTime(localIso, APP_TIMEZONE);
      updates.scheduled_datetime = utcDate.toISOString();
    }

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
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: fetchErr } = await admin
      .from('sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'scheduled' && session.status !== 'pending_payment') {
      return NextResponse.json(
        { error: 'Only scheduled or pending-payment sessions can be deleted' },
        { status: 400 }
      );
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
