import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { generateInviteCode } from '@/lib/sessions';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import { createNotification } from '@/lib/notifications';
import type { SessionMode, JoinPolicy } from '@/types';
import { formatEST } from '@/lib/format-date';

export async function POST(req: NextRequest) {
  try {
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
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as {
      athleteId: string;
      facilityId: string | null;
      youthWrestlerIds: string[];
      sessionMode: SessionMode;
      partnerOption?: 'invite' | 'open' | 'solo';
      joinPolicy?: JoinPolicy;
      scheduledDate: string;
      scheduledTime: string;
      totalPrice: number;
      pricePerParticipant?: number;
      productId?: string;
    };
    const {
      athleteId,
      facilityId,
      youthWrestlerIds,
      sessionMode,
      joinPolicy: joinPolicyFromBody,
      scheduledDate,
      scheduledTime,
      totalPrice,
      pricePerParticipant,
      productId,
    } = body;

    if (!athleteId || !youthWrestlerIds?.length || !scheduledDate || !scheduledTime || totalPrice == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Resolve facility: use athlete's default if not provided
    let facility_id = facilityId;
    if (!facility_id) {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('facility_id')
        .eq('id', athleteId)
        .single();
      facility_id = athlete?.facility_id ?? null;
    }
    if (!facility_id) {
      return NextResponse.json({ error: 'Facility required' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const numParticipants = youthWrestlerIds.length;
    const isPartner = sessionMode === 'partner-invite' || sessionMode === 'partner-open';
    const maxParticipants = isPartner ? 2 : Math.max(1, numParticipants);
    const sessionType = sessionMode === 'private' ? '1-on-1' : '2-athlete';

    // Check for early adopter free session (1 free 1-on-1, 1 free 2-athlete per parent who signed up with code)
    const { data: entitlement } = await admin
      .from('early_adopter_entitlements')
      .select('id, remaining')
      .eq('parent_id', user.id)
      .eq('session_type', sessionType)
      .gt('remaining', 0)
      .limit(1)
      .maybeSingle();

    const useEarlyAdopter = !!entitlement?.id && (entitlement.remaining ?? 0) > 0;

    const [datePart] = scheduledDate.split('T');
    const scheduledDatetime = `${datePart}T${scheduledTime}`;
    
    const testModePenny = process.env.TEST_MODE_PENNY_PRICING === 'true';
    const athletePayment = testModePenny ? 0.50 : totalPrice; // what we pay the coach (you pay manually)
    const basePrice = useEarlyAdopter ? 0 : (testModePenny ? 0.50 : totalPrice);
    const stripeChargeAmount = basePrice;
    const orgFee = 0;
    const stripeFee = 0;

    const join_policy: JoinPolicy =
      joinPolicyFromBody ??
      (sessionMode === 'partner-invite' ? 'invite_only' : sessionMode === 'partner-open' ? 'public' : 'private');

    let partner_invite_code: string | null = null;
    if (join_policy === 'invite_only') {
      let code = generateInviteCode();
      let { data: existing } = await supabase.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
      while (existing) {
        code = generateInviteCode();
        const r = await supabase.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
        existing = r.data;
      }
      partner_invite_code = code;
    }

    let sessionProductId: string | undefined;
    let sessionServiceId: string | undefined;
    let durationMinutes = 60;
    if (productId) {
      const { data: product } = await admin.from('products').select('id').eq('id', productId).maybeSingle();
      const { data: service } = await admin.from('athlete_services').select('id, duration_minutes').eq('id', productId).eq('athlete_id', athleteId).maybeSingle();
      if (product) {
        sessionProductId = productId;
      } else if (service) {
        sessionServiceId = productId;
        durationMinutes = service.duration_minutes ?? 60;
      }
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        parent_id: user.id,
        athlete_id: athleteId,
        facility_id,
        product_id: sessionProductId ?? undefined,
        athlete_service_id: sessionServiceId ?? undefined,
        session_type: sessionType,
        session_mode: sessionMode,
        join_policy,
        partner_invite_code: partner_invite_code ?? undefined,
        max_participants: maxParticipants,
        current_participants: numParticipants,
        base_price: basePrice,
        price_per_participant: testModePenny ? 0.50 : (pricePerParticipant ?? undefined),
        scheduled_datetime: scheduledDatetime,
        duration_minutes: durationMinutes,
        total_price: basePrice,
        athlete_payment: athletePayment,
        org_fee: orgFee,
        stripe_fee: stripeFee,
        paid_with_credit: false,
        early_adopter_entitlement_id: useEarlyAdopter ? entitlement!.id : undefined,
        status: useEarlyAdopter && process.env.STRIPE_CHECKOUT_ENABLED !== 'true' ? 'scheduled' : 'pending_payment',
        athlete_paid: false,
      })
      .select('id, partner_invite_code, session_mode')
      .single();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Consume early-adopter entitlement only when NOT going through Stripe (when Stripe is used, webhook decrements)
    const stripeEnabled = process.env.STRIPE_CHECKOUT_ENABLED === 'true';
    if (useEarlyAdopter && entitlement?.id && !stripeEnabled) {
      await admin
        .from('early_adopter_entitlements')
        .update({ remaining: (entitlement.remaining ?? 1) - 1 })
        .eq('id', entitlement.id);
    }

    try {
      await createNotification(admin, {
        user_id: athleteId,
        type: 'new_session',
        title: 'New session booked',
        body: `Session on ${formatEST(new Date(scheduledDatetime), 'MMM d, yyyy')} at ${formatEST(new Date(scheduledDatetime), 'h:mm a')}. View your dashboard.`,
        data: { link: '/athlete-dashboard', session_id: session.id },
      });
    } catch (notifErr) {
      console.warn('Notify coach of new session failed:', notifErr);
    }

    const participantPaidNow = useEarlyAdopter && !stripeEnabled;
    for (const ywId of youthWrestlerIds) {
      const { error: partError } = await supabase.from('session_participants').insert({
        session_id: session.id,
        youth_wrestler_id: ywId,
        parent_id: user.id,
        paid: participantPaidNow,
        amount_paid: participantPaidNow ? 0 : (testModePenny ? (0.50 / numParticipants) : (pricePerParticipant ?? totalPrice / numParticipants)),
      });
      if (partError) {
        await supabase.from('sessions').delete().eq('id', session.id);
        if (useEarlyAdopter && entitlement?.id && !stripeEnabled) {
          await admin.from('early_adopter_entitlements').update({ remaining: (entitlement.remaining ?? 1) }).eq('id', entitlement.id);
        }
        return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 });
      }
    }

    // Stripe Checkout: enable by setting STRIPE_CHECKOUT_ENABLED=true (and keys + webhook).
    // When disabled, booking creates session as pending_payment and we redirect to confirmed without payment.
    let checkoutUrl: string | undefined;
    console.log('[Bookings API] STRIPE_CHECKOUT_ENABLED:', process.env.STRIPE_CHECKOUT_ENABLED);
    console.log('[Bookings API] Charge amount:', stripeChargeAmount);
    console.log('[Bookings API] Tenant slug:', tenant.slug);
    
    if (process.env.STRIPE_CHECKOUT_ENABLED === 'true' && (stripeChargeAmount >= 0.50 || useEarlyAdopter)) {
      try {
        console.log('[Bookings API] Attempting to create Stripe checkout session...');
        const stripe = getStripeInstance(tenant.slug);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
        const successParams = new URLSearchParams({ sessionId: session.id });
        if (session.partner_invite_code) successParams.set('code', session.partner_invite_code);
        if (session.session_mode) successParams.set('mode', session.session_mode);
        
        const amountCents = Math.round(stripeChargeAmount * 100);
        const isFreeCheckout = useEarlyAdopter && amountCents === 0;
        const metadata: Record<string, string> = { session_id: session.id, app: 'the-guild', test_mode: testModePenny ? 'true' : 'false' };
        if (isFreeCheckout && entitlement?.id) metadata.early_adopter_entitlement_id = entitlement.id;

        const stripeSession = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: amountCents > 0 ? ['card'] : undefined,
          line_items: [{
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              product_data: {
                name: isFreeCheckout ? 'The Guild – Free Session (Early Adopter)' : 'The Guild – Wrestling Session',
                description: isFreeCheckout
                  ? `Free session on ${scheduledDate} at ${scheduledTime}`
                  : testModePenny
                    ? `TEST MODE: Session on ${scheduledDate} at ${scheduledTime} (actual price: $${totalPrice.toFixed(2)})`
                    : `Session on ${scheduledDate} at ${scheduledTime}`,
                metadata: { app: 'the-guild', test_mode: testModePenny ? 'true' : 'false' },
              },
            },
          }],
          metadata,
          success_url: `${baseUrl}/book/${athleteId}/confirmed?${successParams.toString()}`,
          cancel_url: `${baseUrl}/book/${athleteId}`,
          customer_email: user.email ?? undefined,
        });
        checkoutUrl = stripeSession.url ?? undefined;
        console.log('[Bookings API] Stripe checkout URL created:', checkoutUrl, isFreeCheckout ? '(no-cost early adopter)' : '');
      } catch (stripeErr) {
        console.error('[Bookings API] Stripe Checkout ERROR:', stripeErr);
        console.error('[Bookings API] Error details:', JSON.stringify(stripeErr, null, 2));
      }
    } else if (stripeChargeAmount < 0.50 && stripeChargeAmount > 0) {
      // Amount below Stripe minimum; confirm session without payment
      await admin
        .from('sessions')
        .update({ status: 'scheduled', athlete_paid: true })
        .eq('id', session.id);
      await admin
        .from('session_participants')
        .update({ paid: true })
        .eq('session_id', session.id);
      
      return NextResponse.json({
        sessionId: session.id,
        partnerInviteCode: session.partner_invite_code ?? undefined,
        sessionMode: session.session_mode,
      });
    } else {
      console.log('[Bookings API] Stripe checkout is DISABLED or no charge needed');
    }

    return NextResponse.json({
      sessionId: session.id,
      partnerInviteCode: session.partner_invite_code ?? undefined,
      sessionMode: session.session_mode,
      ...(checkoutUrl && { url: checkoutUrl }),
      ...(useEarlyAdopter && { usedEarlyAdopter: true }),
    });
  } catch (e) {
    console.error('Bookings API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
