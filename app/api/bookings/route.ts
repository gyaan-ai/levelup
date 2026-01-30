import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
      useCredits?: boolean;
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
      useCredits = true, // Default to using credits if available
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

    // Calculate credits and remaining amount
    const admin = createAdminClient(tenant.slug);
    let creditBalance = 0;
    let creditsToUse = 0;
    let amountToCharge = totalPrice;
    const creditUsageRecords: { creditId: string; amount: number }[] = [];

    if (useCredits) {
      // Fetch available credits (non-expired, with remaining balance)
      const { data: credits } = await admin
        .from('credits')
        .select('id, remaining, expires_at')
        .eq('parent_id', user.id)
        .gt('remaining', 0)
        .order('created_at', { ascending: true }); // Use oldest first (FIFO)

      const now = new Date();
      const validCredits = (credits || []).filter(c => 
        c.remaining > 0 && (!c.expires_at || new Date(c.expires_at) > now)
      );
      creditBalance = validCredits.reduce((sum, c) => sum + Number(c.remaining), 0);

      // Apply test mode pricing if enabled
      const testModePenny = process.env.TEST_MODE_PENNY_PRICING === 'true';
      const priceToUse = testModePenny ? 0.50 : totalPrice;

      // Allocate credits (FIFO)
      let remaining = priceToUse;
      for (const credit of validCredits) {
        if (remaining <= 0) break;
        const useAmount = Math.min(Number(credit.remaining), remaining);
        creditsToUse += useAmount;
        remaining -= useAmount;
        creditUsageRecords.push({ creditId: credit.id, amount: useAmount });
      }
      amountToCharge = remaining; // What's left after credits
    }

    const numParticipants = youthWrestlerIds.length;
    const isPartner = sessionMode === 'partner-invite' || sessionMode === 'partner-open';
    const maxParticipants = isPartner ? 2 : Math.max(1, numParticipants);
    const sessionType = sessionMode === 'private' ? '1-on-1' : '2-athlete';

    const [datePart] = scheduledDate.split('T');
    const scheduledDatetime = `${datePart}T${scheduledTime}`;
    
    // Actual charge amount (after credits applied)
    const testModePenny = process.env.TEST_MODE_PENNY_PRICING === 'true';
    const basePrice = testModePenny ? 0.50 : totalPrice;
    const creditUsed = creditsToUse;
    const stripeChargeAmount = Math.max(0, basePrice - creditUsed);
    const athletePayment = basePrice;
    const orgFee = 0;
    const stripeFee = 0;
    const fullyPaidWithCredit = stripeChargeAmount === 0 && creditUsed > 0;

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
        base_price: basePrice,
        price_per_participant: testModePenny ? 0.50 : (pricePerParticipant ?? undefined),
        scheduled_datetime: scheduledDatetime,
        duration_minutes: 60,
        total_price: basePrice,
        athlete_payment: athletePayment,
        org_fee: orgFee,
        stripe_fee: stripeFee,
        paid_with_credit: fullyPaidWithCredit,
        status: fullyPaidWithCredit ? 'scheduled' : 'pending_payment',
        athlete_paid: fullyPaidWithCredit,
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
        paid: fullyPaidWithCredit,
        amount_paid: testModePenny ? (0.50 / numParticipants) : (pricePerParticipant ?? totalPrice / numParticipants),
      });
      if (partError) {
        await supabase.from('sessions').delete().eq('id', session.id);
        return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 });
      }
    }

    // Apply credit usage if credits were used
    if (creditUsageRecords.length > 0) {
      for (const record of creditUsageRecords) {
        // Insert credit_usage record
        await admin.from('credit_usage').insert({
          credit_id: record.creditId,
          session_id: session.id,
          amount: record.amount,
        });
        // Deduct from credit remaining
        const { data: credit } = await admin
          .from('credits')
          .select('remaining')
          .eq('id', record.creditId)
          .single();
        if (credit) {
          await admin
            .from('credits')
            .update({ remaining: Number(credit.remaining) - record.amount, updated_at: new Date().toISOString() })
            .eq('id', record.creditId);
        }
      }
    }

    // If fully paid with credit, skip Stripe and return success
    if (fullyPaidWithCredit) {
      return NextResponse.json({
        sessionId: session.id,
        partnerInviteCode: session.partner_invite_code ?? undefined,
        sessionMode: session.session_mode,
        paidWithCredit: true,
        creditUsed: creditUsed,
      });
    }

    // Stripe Checkout: enable by setting STRIPE_CHECKOUT_ENABLED=true (and keys + webhook).
    // When disabled, booking creates session as pending_payment and we redirect to confirmed without payment.
    let checkoutUrl: string | undefined;
    console.log('[Bookings API] STRIPE_CHECKOUT_ENABLED:', process.env.STRIPE_CHECKOUT_ENABLED);
    console.log('[Bookings API] Credits used:', creditUsed, 'Remaining to charge:', stripeChargeAmount);
    console.log('[Bookings API] Tenant slug:', tenant.slug);
    
    if (process.env.STRIPE_CHECKOUT_ENABLED === 'true' && stripeChargeAmount >= 0.50) {
      try {
        console.log('[Bookings API] Attempting to create Stripe checkout session...');
        const stripe = getStripeInstance(tenant.slug);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
        const successParams = new URLSearchParams({ sessionId: session.id });
        if (session.partner_invite_code) successParams.set('code', session.partner_invite_code);
        if (session.session_mode) successParams.set('mode', session.session_mode);
        
        // Charge the remaining amount after credits
        console.log('[Bookings API] Stripe charge amount:', stripeChargeAmount);
        
        const stripeSession = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(stripeChargeAmount * 100),
              product_data: {
                name: creditUsed > 0 ? 'The Guild – Session (partial credit applied)' : 'The Guild – Wrestling Session',
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
    } else if (stripeChargeAmount < 0.50 && stripeChargeAmount > 0) {
      // Amount too small for Stripe, treat as fully paid with credits
      await admin
        .from('sessions')
        .update({ status: 'scheduled', athlete_paid: true, paid_with_credit: true })
        .eq('id', session.id);
      await admin
        .from('session_participants')
        .update({ paid: true })
        .eq('session_id', session.id);
      
      return NextResponse.json({
        sessionId: session.id,
        partnerInviteCode: session.partner_invite_code ?? undefined,
        sessionMode: session.session_mode,
        paidWithCredit: true,
        creditUsed: creditUsed,
        message: `Session booked! $${creditUsed.toFixed(2)} credit applied, $${stripeChargeAmount.toFixed(2)} remaining amount waived.`,
      });
    } else {
      console.log('[Bookings API] Stripe checkout is DISABLED or no charge needed');
    }

    return NextResponse.json({
      sessionId: session.id,
      partnerInviteCode: session.partner_invite_code ?? undefined,
      sessionMode: session.session_mode,
      creditUsed: creditUsed,
      ...(checkoutUrl && { url: checkoutUrl }),
    });
  } catch (e) {
    console.error('Bookings API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
