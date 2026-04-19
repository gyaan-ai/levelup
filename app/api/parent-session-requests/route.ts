import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import { normalizeCoachOrWrestlerId, verifyCoachForParentBooking } from '@/lib/server-booking-coach';

const SELECT_FIELDS = `
  id,
  requesting_parent_id,
  youth_wrestler_id,
  coach_id,
  facility_id,
  preferred_datetime,
  session_type,
  duration_minutes,
  counter_preferred_datetime,
  counter_note,
  payment_deadline_at,
  message,
  flexibility_note,
  status,
  coach_response,
  created_session_id,
  responded_at,
  created_at,
  updated_at,
  youth_wrestlers:youth_wrestler_id(id, first_name, last_name, age, weight_class),
  athletes:coach_id(id, first_name, last_name, school, photo_url),
  facilities:facility_id(id, name)
`;

export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = userData?.role;

    let q = supabase.from('parent_session_requests').select(SELECT_FIELDS).order('created_at', { ascending: false });

    if (role === 'parent') {
      q = q.eq('requesting_parent_id', user.id);
    } else if (role === 'coach') {
      q = q.eq('coach_id', user.id);
    } else if (role === 'admin') {
      // Admins testing: no global list; use coach view if they have athlete row, else empty
      const { data: ath } = await supabase.from('athletes').select('id').eq('id', user.id).maybeSingle();
      if (ath) q = q.eq('coach_id', user.id);
      else return NextResponse.json({ requests: [] });
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ requests: data ?? [] });
  } catch (e) {
    console.error('parent-session-requests GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Only parents can request sessions' }, { status: 403 });
    }

    const body = (await req.json()) as {
      coachId?: string;
      youthWrestlerId?: string;
      facilityId?: string | null;
      preferredDatetime?: string | null;
      sessionType?: string | null;
      durationMinutes?: number | null;
      message?: string | null;
      flexibilityNote?: string | null;
    };

    const coachId = normalizeCoachOrWrestlerId(body.coachId);
    const youthWrestlerId = normalizeCoachOrWrestlerId(body.youthWrestlerId);
    if (!coachId || !youthWrestlerId) {
      return NextResponse.json({ error: 'Invalid or missing coach or wrestler id.' }, { status: 400 });
    }

    const message = body.message?.trim() ?? '';
    const flex = body.flexibilityNote?.trim() ?? '';
    const preferredDatetime = body.preferredDatetime?.trim() ? body.preferredDatetime : null;

    if (!message && !preferredDatetime && !flex) {
      return NextResponse.json(
        { error: 'Add a preferred time, a message, or when you are flexible.' },
        { status: 400 }
      );
    }

    const { data: yw } = await supabase
      .from('youth_wrestlers')
      .select('id, parent_id, first_name, last_name')
      .eq('id', youthWrestlerId)
      .single();
    if (!yw || (yw as { parent_id?: string }).parent_id !== user.id) {
      return NextResponse.json({ error: 'Youth wrestler not found or not yours' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const coachCheck = await verifyCoachForParentBooking(admin, coachId);
    if (!coachCheck.ok) {
      return NextResponse.json({ error: coachCheck.error }, { status: coachCheck.status });
    }

    if (coachId === user.id) {
      return NextResponse.json({ error: 'You cannot request a session from yourself' }, { status: 400 });
    }

    let resolvedFacilityId: string | null =
      body.facilityId != null && String(body.facilityId).trim() !== ''
        ? normalizeCoachOrWrestlerId(body.facilityId)
        : null;
    if (resolvedFacilityId) {
      const { data: fac } = await supabase.from('facilities').select('id').eq('id', resolvedFacilityId).maybeSingle();
      if (!fac) resolvedFacilityId = null;
    }

    const sessionType = body.sessionType?.trim() || null;
    const allowedSessionTypes = ['private', 'small_group', 'partner', 'group'] as const;
    const st =
      sessionType && (allowedSessionTypes as readonly string[]).includes(sessionType)
        ? (sessionType as (typeof allowedSessionTypes)[number])
        : null;

    const dmRaw = body.durationMinutes != null ? Number(body.durationMinutes) : 60;
    const duration_minutes = [30, 60, 90, 120].includes(dmRaw) ? dmRaw : 60;

    const insertRow = {
      requesting_parent_id: user.id,
      youth_wrestler_id: youthWrestlerId,
      coach_id: coachId,
      facility_id: resolvedFacilityId,
      preferred_datetime: preferredDatetime,
      session_type: st || null,
      duration_minutes,
      message: message || null,
      flexibility_note: flex || null,
      status: 'pending' as const,
    };

    const { data: inserted, error } = await supabase.from('parent_session_requests').insert(insertRow).select('id').single();

    if (error) {
      console.error('parent_session_requests insert:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ywName = [yw.first_name, yw.last_name].filter(Boolean).join(' ') || 'Your athlete';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const link = `${baseUrl}/coach-sessions?tab=requests`;

    try {
      await createNotification(admin, {
        user_id: coachId,
        type: 'parent_session_request',
        title: 'New session request',
        body: `${ywName} — ${message ? message.slice(0, 120) + (message.length > 120 ? '…' : '') : 'Preferred time proposed.'}`,
        data: { requestId: inserted?.id, link, coachId },
        coachId,
      });
    } catch (notifErr) {
      console.warn('parent session request notification failed:', notifErr);
    }

    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (e) {
    console.error('parent-session-requests POST:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
