import type { SupabaseClient } from '@supabase/supabase-js';
import { formatEST } from '@/lib/format-date';
import { generateInviteCode, getSessionPrice, type SessionPricing } from '@/lib/sessions';
import type { SessionMode } from '@/types';
import type { JoinPolicy } from '@/types';
import { COACH_REVENUE_FRACTION } from '@/lib/pricing';
import { hasMinPhoneDigits } from '@/lib/phone';
import { maybeBackfillRosterSnapshot } from '@/lib/session-roster-snapshot';

export type RequestSessionKind = 'private' | 'partner';

export type CreateSessionFromParentRequestInput = {
  parentId: string;
  coachId: string;
  youthWrestlerId: string;
  facilityId: string | null;
  scheduledDatetimeIso: string;
  sessionKind: RequestSessionKind;
  durationMinutes: number;
  tenantPricing: SessionPricing;
};

type PricingResolved = {
  totalPrice: number;
  pricePerParticipant: number;
  athletePayment: number;
  durationMinutes: number;
  sessionProductId?: string;
  sessionServiceId?: string;
};

async function resolvePricing(
  admin: SupabaseClient,
  coachId: string,
  sessionKind: RequestSessionKind,
  durationMinutes: number,
  tenantPricing: SessionPricing
): Promise<PricingResolved> {
  const sessionType = sessionKind === 'private' ? 'private' : 'partner';
  const { data: svc } = await admin
    .from('athlete_services')
    .select('id, parent_price, athlete_payout, duration_minutes')
    .eq('athlete_id', coachId)
    .eq('active', true)
    .eq('session_type', sessionType)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (svc) {
    const pp = Number(svc.parent_price);
    const ap = Number(svc.athlete_payout);
    const dm = Number(svc.duration_minutes) || durationMinutes;
    const numP = sessionKind === 'private' ? 1 : 1;
    return {
      totalPrice: pp * numP,
      pricePerParticipant: pp,
      athletePayment: ap * numP,
      durationMinutes: dm,
      sessionServiceId: svc.id,
    };
  }

  const slug = sessionKind === 'private' ? 'private' : 'partner';
  const { data: prod } = await admin
    .from('products')
    .select('id, parent_price, athlete_payout, min_participants, max_participants')
    .eq('active', true)
    .eq('slug', slug)
    .maybeSingle();

  if (prod) {
    const pp = Number(prod.parent_price);
    const ap = Number(prod.athlete_payout);
    const mode: SessionMode = sessionKind === 'private' ? 'private' : 'partner-invite';
    const numP = sessionKind === 'private' ? 1 : 1;
    const priceInfo = getSessionPrice(mode, numP, tenantPricing);
    const total = pp > 0 ? pp * numP : priceInfo.total;
    const per = pp > 0 ? pp : (priceInfo.pricePerParticipant ?? total);
    return {
      totalPrice: total,
      pricePerParticipant: per,
      athletePayment: ap > 0 ? ap * numP : total * COACH_REVENUE_FRACTION,
      durationMinutes,
      sessionProductId: prod.id,
    };
  }

  const mode: SessionMode = sessionKind === 'private' ? 'private' : 'partner-invite';
  const priceInfo = getSessionPrice(mode, sessionKind === 'private' ? 1 : 1, tenantPricing);
  const total = priceInfo.total;
  const per = priceInfo.pricePerParticipant ?? total;
  return {
    totalPrice: total,
    pricePerParticipant: per,
    athletePayment: total * COACH_REVENUE_FRACTION,
    durationMinutes,
  };
}

/**
 * Creates a pending_payment session + participant + cart line after a coach (or parent accepting a counter)
 * approves a parent_session_requests row. Uses service-role client.
 */
export async function createSessionFromParentRequest(
  admin: SupabaseClient,
  input: CreateSessionFromParentRequestInput
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string; status?: number }> {
  const {
    parentId,
    coachId,
    youthWrestlerId,
    facilityId,
    scheduledDatetimeIso,
    sessionKind,
    durationMinutes: requestedDuration,
    tenantPricing,
  } = input;

  let facility_id = facilityId;
  if (!facility_id) {
    const { data: coach } = await admin.from('athletes').select('facility_id').eq('id', coachId).maybeSingle();
    facility_id = coach?.facility_id ?? null;
  }
  if (!facility_id) {
    return { ok: false, error: 'Coach has no primary facility — set one before approving.', status: 400 };
  }

  const { data: ywRow } = await admin
    .from('youth_wrestlers')
    .select('id, parent_id, phone, first_name, last_name, photo_url')
    .eq('id', youthWrestlerId)
    .maybeSingle();
  if (!ywRow || ywRow.parent_id !== parentId) {
    return { ok: false, error: 'Athlete not found for this parent.', status: 400 };
  }
  if (!hasMinPhoneDigits(ywRow.phone)) {
    return {
      ok: false,
      error: 'Athlete needs a cell number on file before booking. Ask the parent to update the wrestler profile.',
      status: 400,
    };
  }

  const pricing = await resolvePricing(admin, coachId, sessionKind, requestedDuration, tenantPricing);

  const sessionMode: SessionMode = sessionKind === 'private' ? 'private' : 'partner-invite';
  const sessionType = sessionKind === 'private' ? '1-on-1' : '2-athlete';
  const maxParticipants = sessionKind === 'private' ? 1 : 2;
  const join_policy: JoinPolicy = 'invite_only';

  let partner_invite_code: string | null = null;
  let code = generateInviteCode();
  let { data: existing } = await admin.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
  while (existing) {
    code = generateInviteCode();
    const r = await admin.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
    existing = r.data;
  }
  partner_invite_code = code;

  const testModePenny = process.env.TEST_MODE_PENNY_PRICING === 'true';
  const basePrice = testModePenny ? 0.50 : pricing.totalPrice;
  const athletePayment = testModePenny ? 0.50 : pricing.athletePayment;

  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .insert({
      parent_id: parentId,
      athlete_id: coachId,
      facility_id,
      product_id: pricing.sessionProductId ?? undefined,
      athlete_service_id: pricing.sessionServiceId ?? undefined,
      session_type: sessionType,
      session_mode: sessionMode,
      join_policy,
      partner_invite_code: partner_invite_code ?? undefined,
      max_participants: maxParticipants,
      current_participants: 1,
      base_price: basePrice,
      price_per_participant: testModePenny ? 0.50 : pricing.pricePerParticipant,
      scheduled_datetime: scheduledDatetimeIso,
      duration_minutes: pricing.durationMinutes,
      total_price: basePrice,
      athlete_payment: athletePayment,
      org_fee: 0,
      stripe_fee: 0,
      paid_with_credit: false,
      status: 'pending_payment',
      athlete_paid: false,
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    console.error('[createSessionFromParentRequest] session insert', sessionError);
    return { ok: false, error: sessionError?.message || 'Failed to create session', status: 500 };
  }

  const sessionId = session.id as string;

  const partAmount = testModePenny ? 0.50 : pricing.pricePerParticipant;
  const { error: partError } = await admin.from('session_participants').insert({
    session_id: sessionId,
    youth_wrestler_id: youthWrestlerId,
    parent_id: parentId,
    paid: false,
    amount_paid: partAmount,
  });
  if (partError) {
    await admin.from('sessions').delete().eq('id', sessionId);
    console.error('[createSessionFromParentRequest] participant', partError);
    return { ok: false, error: 'Failed to add participant', status: 500 };
  }

  await maybeBackfillRosterSnapshot(
    admin,
    { session_id: sessionId, youth_wrestler_id: youthWrestlerId },
    ywRow ?? {}
  );

  const lineId = crypto.randomUUID();
  const { error: cartErr } = await admin.from('cart_items').insert({
    id: lineId,
    user_id: parentId,
    session_id: sessionId,
    athlete_id: youthWrestlerId,
  });
  if (cartErr) {
    console.warn('[createSessionFromParentRequest] cart_items', cartErr);
  }

  return { ok: true, sessionId };
}

export function paymentDeadlineIso(hoursFromNow = 24): string {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
}

export function formatSessionWhenForNotification(scheduledDatetimeIso: string): string {
  const d = new Date(scheduledDatetimeIso);
  return `${formatEST(d, 'EEE MMM d')} · ${formatEST(d, 'h:mm a')}`;
}
