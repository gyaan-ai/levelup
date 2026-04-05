import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { fromZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantFromRequestHeaders } from '@/config/tenants';
import { generateInviteCode } from '@/lib/sessions';
import { APP_TIMEZONE } from '@/lib/format-date';
import { notifySessionScheduledFollowers } from '@/lib/notify-session-scheduled-followers';
import {
  getRecommendedPricePerParticipant,
  type CoachCreateSessionType,
} from '@/lib/coach-session-pricing';

/** Trim + lowercase for Postgres uuid text comparisons; returns null if not a plausible UUID string. */
function normalizeUuidParam(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)) return null;
  return s;
}

/**
 * POST - Admin creates a small-group session: assign coach, set time/facility, get shareable link.
 * Body: { athleteId, facilityId, scheduledDate, scheduledTime, durationMinutes, maxParticipants, pricePerParticipant }
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantFromRequestHeaders(headersList);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';
    const isCoach = userData?.role === 'coach';
    if (!isAdmin && !isCoach) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as {
      athleteId: string;
      facilityId: string;
      scheduledDate: string;
      scheduledTime: string;
      durationMinutes?: number;
      maxParticipants?: number;
      pricePerParticipant?: number;
      sessionType?: CoachCreateSessionType;
      joinPolicy?: 'public' | 'invite_only' | 'private';
      published?: boolean;
      focusArea?: string;
      focusArea2?: string;
    };
    const {
      athleteId: rawAthleteId,
      facilityId: rawFacilityId,
      scheduledDate,
      scheduledTime,
      durationMinutes = 60,
      maxParticipants = 8,
      pricePerParticipant: bodyPrice,
      sessionType = 'small_group',
      joinPolicy = 'public',
      focusArea,
      focusArea2,
    } = body;

    const athleteId = normalizeUuidParam(rawAthleteId);
    const facilityId = normalizeUuidParam(rawFacilityId);

    if (!athleteId || !facilityId || !scheduledDate || !scheduledTime) {
      return NextResponse.json(
        {
          error:
            !athleteId || !facilityId
              ? 'Invalid or missing coach or facility. Refresh the page and pick the coach and facility again.'
              : 'Missing scheduledDate or scheduledTime',
        },
        { status: 400 }
      );
    }

    const userIdNorm = String(user.id).trim().toLowerCase();

    // Coaches can only create sessions for themselves
    if (isCoach && athleteId !== userIdNorm) {
      return NextResponse.json({ error: 'Coaches can only create sessions for themselves' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);

    const [datePart] = scheduledDate.split('T');
    // Interpret date + time as Eastern; store UTC so display (formatEST) shows correct time
    const timePart = scheduledTime.includes(':') ? scheduledTime : `${scheduledTime}:00`;
    const localIso = `${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
    const utcDate = fromZonedTime(localIso, APP_TIMEZONE);
    const scheduledDatetime = utcDate.toISOString();
    const rawMax = Number(maxParticipants);
    const max =
      sessionType === 'private'
        ? Math.min(20, Math.max(1, Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 1))
        : Math.min(20, Math.max(2, Number.isFinite(rawMax) && rawMax > 0 ? rawMax : sessionType === 'partner' ? 2 : 6));
    const duration = Math.min(120, Math.max(30, Number(durationMinutes) || 60));

    // Coach must exist in athletes (same id as auth user for coaches) — also get payout rate
    const { data: athlete, error: athleteErr } = await admin
      .from('athletes')
      .select('id, payout_rate')
      .eq('id', athleteId)
      .maybeSingle();
    if (athleteErr) {
      console.error('[admin/sessions POST] athletes lookup error', { athleteId, code: athleteErr.code, message: athleteErr.message });
      return NextResponse.json({ error: 'Could not verify coach. Try again.' }, { status: 500 });
    }
    if (!athlete) {
      const { data: urow } = await admin.from('users').select('id, role, email').eq('id', athleteId).maybeSingle();
      if (urow?.role === 'coach') {
        return NextResponse.json(
          {
            error:
              'This coach account has no athlete profile row. They may need to finish signup, or the profile was removed. Fix in Supabase (athletes) or Admin → Users before creating sessions.',
          },
          { status: 409 }
        );
      }
      console.error('[admin/sessions POST] coach id not in athletes', { athleteId, usersRole: urow?.role ?? null });
      const mismatchHint =
        ' If coaches show in the list but this fails, the app server may be using a different Supabase project than the one you checked (verify NEXT_PUBLIC_* and *_SUPABASE_SERVICE_KEY match the same project).';
      const errorMsg = urow
        ? `No coach profile in athletes for this account (user role: ${urow.role}). Session creation requires a row in public.athletes with id equal to the coach user id.${mismatchHint}`
        : `Coach not found for that id (no matching users row). Refresh and pick the coach again.${mismatchHint}`;
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }
    // Default to 80% (0.8000), founding coaches get 83.33% (0.8333)
    const coachPayoutRate = (athlete as { payout_rate?: number }).payout_rate ?? 0.8000;

    const sessionTypeKey = (sessionType || 'small_group') as CoachCreateSessionType;
    const defaultPrice = await getRecommendedPricePerParticipant(admin, athleteId, sessionTypeKey);
    const hasExplicitPrice =
      bodyPrice !== undefined &&
      bodyPrice !== null &&
      String(bodyPrice).trim() !== '' &&
      !Number.isNaN(Number(bodyPrice));
    const price = hasExplicitPrice ? Math.max(0, Number(bodyPrice)) : defaultPrice;

    // Facility must exist
    const { data: facility, error: facilityErr } = await admin
      .from('facilities')
      .select('id')
      .eq('id', facilityId)
      .maybeSingle();
    if (facilityErr || !facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    let code = generateInviteCode();
    let { data: existing } = await admin.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
    while (existing) {
      code = generateInviteCode();
      const r = await admin.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
      existing = r.data;
    }

    const orgFee = 0;
    const stripeFee = 0;
    const totalPrice = 0;
    const athletePayment = 0; // pay-per-person; coach payout = price × COACH_REVENUE_FRACTION × participants (5/6)

    // Assign session to the selected coach (parent_id = athlete_id) so they own it and see it on their schedule
    // Check if published flag is passed (default to true for backward compat)
    const published = body.published !== false;

    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .insert({
        parent_id: athleteId,
        athlete_id: athleteId,
        facility_id: facilityId,
        // Map UI values to DB constraint values: '1-on-1', '2-athlete', 'group'
        session_type: sessionType === 'small_group' ? 'group' : sessionType === 'partner' ? '2-athlete' : '1-on-1',
        session_mode: sessionType === 'private' ? 'private' : 'partner-invite',
        join_policy: joinPolicy,
        partner_invite_code: code,
        max_participants: max,
        current_participants: 0,
        base_price: 0,
        price_per_participant: price,
        scheduled_datetime: scheduledDatetime,
        duration_minutes: duration,
        total_price: totalPrice,
        athlete_payment: athletePayment,
        org_fee: orgFee,
        stripe_fee: stripeFee,
        paid_with_credit: false,
        status: 'scheduled',
        athlete_paid: false,
        focus_area: focusArea && String(focusArea).trim() ? String(focusArea).trim() : null,
        focus_area_2: focusArea2 && String(focusArea2).trim() ? String(focusArea2).trim() : null,
        session_payout_rate: coachPayoutRate,
        published,
      })
      .select('id, partner_invite_code, scheduled_datetime, max_participants, price_per_participant, published')
      .single();

    if (sessionError) {
      console.error('Admin create session error:', sessionError);
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const shareUrl = `${baseUrl}/join/${session.partner_invite_code}`;

    // Only notify followers if session is published
    if (session.published) {
      void notifySessionScheduledFollowers(tenant.slug, athlete.id, {
        sessionId: session.id,
        scheduledDatetime: session.scheduled_datetime,
        joinUrlPath: `/join/${session.partner_invite_code}`,
      });
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      partnerInviteCode: session.partner_invite_code,
      shareUrl,
      scheduledDatetime: session.scheduled_datetime,
      maxParticipants: session.max_participants,
      pricePerParticipant: session.price_per_participant,
    });
  } catch (e) {
    console.error('Admin sessions POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
