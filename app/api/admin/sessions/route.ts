import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { fromZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { generateInviteCode } from '@/lib/sessions';
import { APP_TIMEZONE } from '@/lib/format-date';

/**
 * POST - Admin creates a small-group session: assign coach, set time/facility, get shareable link.
 * Body: { athleteId, facilityId, scheduledDate, scheduledTime, durationMinutes, maxParticipants, pricePerParticipant }
 */
export async function POST(req: NextRequest) {
  try {
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
      athleteId: string;
      facilityId: string;
      scheduledDate: string;
      scheduledTime: string;
      durationMinutes?: number;
      maxParticipants?: number;
      pricePerParticipant?: number;
      focusArea?: string;
    };
    const {
      athleteId,
      facilityId,
      scheduledDate,
      scheduledTime,
      durationMinutes = 60,
      maxParticipants = 8,
      pricePerParticipant: bodyPrice,
      focusArea,
    } = body;

    if (!athleteId || !facilityId || !scheduledDate || !scheduledTime) {
      return NextResponse.json(
        { error: 'Missing athleteId, facilityId, scheduledDate, or scheduledTime' },
        { status: 400 }
      );
    }

    const admin = createAdminClient(tenant.slug);

    // Coach's small-group price from rate card (products + athlete_products), fallback platform default 30
    let priceFromRateCard: number | null = null;
    const { data: smallGroupProduct } = await admin
      .from('products')
      .select('id, parent_price')
      .eq('slug', 'small-group')
      .maybeSingle();
    if (smallGroupProduct) {
      const { data: ap } = await admin
        .from('athlete_products')
        .select('custom_parent_price')
        .eq('athlete_id', athleteId)
        .eq('product_id', smallGroupProduct.id)
        .maybeSingle();
      const custom = (ap as { custom_parent_price?: number } | null)?.custom_parent_price;
      priceFromRateCard = custom != null ? Number(custom) : Number(smallGroupProduct.parent_price);
    }
    const defaultPrice = priceFromRateCard ?? 30;
    const price = bodyPrice != null ? Number(bodyPrice) || defaultPrice : defaultPrice;

    const [datePart] = scheduledDate.split('T');
    // Interpret date + time as Eastern; store UTC so display (formatEST) shows correct time
    const timePart = scheduledTime.includes(':') ? scheduledTime : `${scheduledTime}:00`;
    const localIso = `${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
    const utcDate = fromZonedTime(localIso, APP_TIMEZONE);
    const scheduledDatetime = utcDate.toISOString();
    const max = Math.min(20, Math.max(2, Number(maxParticipants) || 6));
    const duration = Math.min(120, Math.max(30, Number(durationMinutes) || 60));

    // Coach must exist
    const { data: athlete, error: athleteErr } = await admin
      .from('athletes')
      .select('id')
      .eq('id', athleteId)
      .single();
    if (athleteErr || !athlete) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Facility must exist
    const { data: facility, error: facilityErr } = await admin
      .from('facilities')
      .select('id')
      .eq('id', facilityId)
      .single();
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
    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .insert({
        parent_id: athleteId,
        athlete_id: athleteId,
        facility_id: facilityId,
        session_type: 'group',
        session_mode: 'partner-invite',
        join_policy: 'public',
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
      })
      .select('id, partner_invite_code, scheduled_datetime, max_participants, price_per_participant')
      .single();

    if (sessionError) {
      console.error('Admin create session error:', sessionError);
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const shareUrl = `${baseUrl}/join/${session.partner_invite_code}`;

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
