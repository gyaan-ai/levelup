import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { generateInviteCode } from '@/lib/sessions';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import type { SessionMode } from '@/types';

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
      scheduledDate: string;
      scheduledTime: string;
      totalPrice: number;
      pricePerParticipant?: number;
    };
    const {
      athleteId,
      facilityId,
      youthWrestlerIds,
      sessionMode,
      scheduledDate,
      scheduledTime,
      totalPrice,
      pricePerParticipant,
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

    const numParticipants = youthWrestlerIds.length;
    const isPartner = sessionMode === 'partner-invite' || sessionMode === 'partner-open';
    const maxParticipants = isPartner ? 2 : Math.max(1, numParticipants);
    const sessionType = sessionMode === 'private' ? '1-on-1' : '2-athlete';

    const [datePart] = scheduledDate.split('T');
    const scheduledDatetime = `${datePart}T${scheduledTime}`;
    
    // Use test mode pricing if enabled (Stripe minimum is $0.50 USD)
    const testModePenny = process.env.TEST_MODE_PENNY_PRICING === 'true';
    const actualChargeAmount = testModePenny ? 0.50 : totalPrice;
    const athletePayment = actualChargeAmount;
    const orgFee = 0;
    const stripeFee = 0;

    let partner_invite_code: string | null = null;
    if (sessionMode === 'partner-invite') {
      let code = generateInviteCode();
      let { data: existing } = await supabase.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
      while (existing) {
        code = generateInviteCode();
        const r = await supabase.from('sessions').select('id').eq('partner_invite_code', code).maybeSingle();
        existing = r.data;
      }
      partner_invite_code = code;
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        parent_id: user.id,
        athlete_id: athleteId,
        facility_id,
        session_type: sessionType,
        session_mode: sessionMode,
        partner_invite_code: partner_invite_code ?? undefined,
        max_participants: maxParticipants,
        current_participants: numParticipants,
        base_price: actualChargeAmount,
        price_per_participant: testModePenny ? 0.50 : (pricePerParticipant ?? undefined),
        scheduled_datetime: scheduledDatetime,
        duration_minutes: 60,
        total_price: actualChargeAmount,
        athlete_payment: athletePayment,
        org_fee: orgFee,
        stripe_fee: stripeFee,
        paid_with_credit: false,
        status: 'pending_payment',
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

    for (const ywId of youthWrestlerIds) {
      const { error: partError } = await supabase.from('session_participants').insert({
        session_id: session.id,
        youth_wrestler_id: ywId,
        parent_id: user.id,
        paid: false,
        amount_paid: testModePenny ? (0.50 / numParticipants) : (pricePerParticipant ?? totalPrice / numParticipants),
      });
      if (partError) {
        await supabase.from('sessions').delete().eq('id', session.id);
        return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 });
      }
    }

    // Stripe Checkout: enable by setting STRIPE_CHECKOUT_ENABLED=true (and keys + webhook).
    // When disabled, booking creates session as pending_payment and we redirect to confirmed without payment.
    // TEST_MODE_PENNY_PRICING: Set to 'true' to charge $0.01 instead of full price (for testing live Stripe with minimal cost)
    let checkoutUrl: string | undefined;
    console.log('[Bookings API] STRIPE_CHECKOUT_ENABLED:', process.env.STRIPE_CHECKOUT_ENABLED);
    console.log('[Bookings API] TEST_MODE_PENNY_PRICING:', process.env.TEST_MODE_PENNY_PRICING);
    console.log('[Bookings API] Tenant slug:', tenant.slug);
    
    if (process.env.STRIPE_CHECKOUT_ENABLED === 'true') {
      try {
        console.log('[Bookings API] Attempting to create Stripe checkout session...');
        const stripe = getStripeInstance(tenant.slug);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
        const successParams = new URLSearchParams({ sessionId: session.id });
        if (session.partner_invite_code) successParams.set('code', session.partner_invite_code);
        if (session.session_mode) successParams.set('mode', session.session_mode);
        
        // Use the actual charge amount (test mode pricing already applied above)
        console.log('[Bookings API] Charge amount:', actualChargeAmount, '(test mode:', testModePenny, ')');
        
        const stripeSession = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(actualChargeAmount * 100),
              product_data: {
                name: 'The Guild – Wrestling Session',
                description: testModePenny 
                  ? `TEST MODE: Session on ${scheduledDate} at ${scheduledTime} (actual price: $${totalPrice.toFixed(2)})`
                  : `Session on ${scheduledDate} at ${scheduledTime}`,
                metadata: { app: 'the-guild', test_mode: testModePenny ? 'true' : 'false' },
              },
            },
          }],
          metadata: { session_id: session.id, app: 'the-guild', test_mode: testModePenny ? 'true' : 'false' },
          success_url: `${baseUrl}/book/${athleteId}/confirmed?${successParams.toString()}`,
          cancel_url: `${baseUrl}/book/${athleteId}`,
          customer_email: user.email ?? undefined,
        });
        checkoutUrl = stripeSession.url ?? undefined;
        console.log('[Bookings API] Stripe checkout URL created:', checkoutUrl);
      } catch (stripeErr) {
        console.error('[Bookings API] Stripe Checkout ERROR:', stripeErr);
        console.error('[Bookings API] Error details:', JSON.stringify(stripeErr, null, 2));
      }
    } else {
      console.log('[Bookings API] Stripe checkout is DISABLED');
    }

    return NextResponse.json({
      sessionId: session.id,
      partnerInviteCode: session.partner_invite_code ?? undefined,
      sessionMode: session.session_mode,
      ...(checkoutUrl && { url: checkoutUrl }),
    });
  } catch (e) {
    console.error('Bookings API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
