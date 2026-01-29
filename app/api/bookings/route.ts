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
    if (userData?.role !== 'parent') {
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
    const athletePayment = totalPrice;
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
        base_price: totalPrice,
        price_per_participant: pricePerParticipant ?? undefined,
        scheduled_datetime: scheduledDatetime,
        duration_minutes: 60,
        total_price: totalPrice,
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
        amount_paid: pricePerParticipant ?? totalPrice / numParticipants,
      });
      if (partError) {
        await supabase.from('sessions').delete().eq('id', session.id);
        return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 });
      }
    }

    // Stripe Checkout: enable by setting STRIPE_CHECKOUT_ENABLED=true (and keys + webhook).
    // When disabled, booking creates session as pending_payment and we redirect to confirmed without payment.
    let checkoutUrl: string | undefined;
    if (process.env.STRIPE_CHECKOUT_ENABLED === 'true') {
      try {
        const stripe = getStripeInstance(tenant.slug);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
        const successParams = new URLSearchParams({ sessionId: session.id });
        if (session.partner_invite_code) successParams.set('code', session.partner_invite_code);
        if (session.session_mode) successParams.set('mode', session.session_mode);
        const stripeSession = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(totalPrice * 100),
              product_data: {
                name: 'The Guild – Wrestling Session',
                description: `Session on ${scheduledDate} at ${scheduledTime}`,
                metadata: { app: 'the-guild' },
              },
            },
          }],
          metadata: { session_id: session.id, app: 'the-guild' },
          success_url: `${baseUrl}/book/${athleteId}/confirmed?${successParams.toString()}`,
          cancel_url: `${baseUrl}/book/${athleteId}`,
          customer_email: user.email ?? undefined,
        });
        checkoutUrl = stripeSession.url ?? undefined;
      } catch (stripeErr) {
        console.warn('Stripe Checkout not created (keys or error):', stripeErr);
      }
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
