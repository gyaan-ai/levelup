import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import { formatEST } from '@/lib/format-date';
import { hasMinPhoneDigits } from '@/lib/phone';
import { getEffectiveFilledCount } from '@/lib/sessions';
import { getUserCreditBalance, applyCredits } from '@/lib/credits';

/**
 * POST - Multi-session checkout: pay for multiple sessions in one Stripe transaction.
 * Creates a Stripe Checkout Session with line items for each session.
 * The webhook will handle creating session_participants for each.
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
    const role = userData?.role;
    if (role !== 'parent' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as { sessionIds: string[]; wrestlerId: string };
    const { sessionIds, wrestlerId } = body;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: 'No sessions selected' }, { status: 400 });
    }
    if (!wrestlerId) {
      return NextResponse.json({ error: 'No wrestler selected' }, { status: 400 });
    }

    // Verify wrestler belongs to user
    const { data: yw } = await supabase
      .from('youth_wrestlers')
      .select('id, parent_id, phone, first_name, last_name')
      .eq('id', wrestlerId)
      .single();

    if (!yw) {
      return NextResponse.json({ error: 'Wrestler not found' }, { status: 400 });
    }

    const ywParentId = (yw as { parent_id?: string }).parent_id;
    const isPrimaryParent = ywParentId === user.id;

    if (!isPrimaryParent) {
      const { data: link } = await supabase
        .from('youth_wrestler_parents')
        .select('id')
        .eq('youth_wrestler_id', wrestlerId)
        .eq('parent_id', user.id)
        .maybeSingle();
      if (!link) {
        return NextResponse.json({ error: 'Wrestler not found or not yours' }, { status: 400 });
      }
    }

    // Phone validation removed - allow checkout without wrestler phone number

    const admin = createAdminClient(tenant.slug);

    // Fetch all sessions
    const { data: sessions, error: sessionsErr } = await supabase
      .from('sessions')
      .select(`
        id, parent_id, athlete_id, join_policy, session_mode, session_type,
        current_participants, max_participants, price_per_participant,
        scheduled_datetime, status,
        athletes(first_name, last_name)
      `)
      .in('id', sessionIds);

    if (sessionsErr || !sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'Sessions not found' }, { status: 404 });
    }

    // Validate each session and build line items
    const lineItems: Array<{
      quantity: number;
      price_data: {
        currency: string;
        unit_amount: number;
        product_data: { name: string; description: string };
      };
    }> = [];

    const sessionMetadata: Array<{ session_id: string; price: number }> = [];

    for (const session of sessions) {
      const s = session as {
        id: string;
        parent_id?: string;
        join_policy?: string;
        status?: string;
        current_participants?: number;
        max_participants?: number;
        price_per_participant?: number;
        scheduled_datetime?: string;
        athletes?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
      };

      // Check if session is open
      if (s.join_policy !== 'public' && s.join_policy !== 'invite_only') {
        return NextResponse.json({ error: `Session is not open for registration` }, { status: 400 });
      }
      if (!['scheduled', 'pending_payment'].includes(s.status ?? '')) {
        return NextResponse.json({ error: `Session is not open for registration` }, { status: 400 });
      }

      // Check capacity
      const { count: participantRowCount } = await admin
        .from('session_participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', s.id);

      const max = s.max_participants ?? 2;
      const filled = getEffectiveFilledCount(
        { current_participants: s.current_participants, max_participants: s.max_participants, session_participants: null },
        participantRowCount ?? 0
      );
      if (filled >= max) {
        const dt = s.scheduled_datetime ? formatEST(new Date(s.scheduled_datetime), 'MMM d') : 'a session';
        return NextResponse.json({ error: `Session on ${dt} is full` }, { status: 400 });
      }

      // Check if already registered
      const { data: existing } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', s.id)
        .eq('youth_wrestler_id', wrestlerId)
        .maybeSingle();
      if (existing) {
        const dt = s.scheduled_datetime ? formatEST(new Date(s.scheduled_datetime), 'MMM d') : 'a session';
        return NextResponse.json({ error: `Already registered for session on ${dt}` }, { status: 409 });
      }

      const pricePer = s.price_per_participant != null && s.price_per_participant > 0 ? s.price_per_participant : 30;
      const amountCents = Math.round(pricePer * 100);

      const dt = s.scheduled_datetime ? new Date(s.scheduled_datetime) : null;
      const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
      const coachName = coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') : 'Coach';
      const desc = dt
        ? `${formatEST(dt, 'EEE, MMM d')} at ${formatEST(dt, 'h:mm a')} with ${coachName}`
        : 'Session registration';

      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'The Guild – Session',
            description: desc,
          },
        },
      });

      sessionMetadata.push({ session_id: s.id, price: pricePer });
    }

    // Calculate total price
    let totalPrice = sessionMetadata.reduce((sum, m) => sum + m.price, 0);

    // Check for parent percentage discount (from promo code like FAMILY10)
    const { data: discountData, error: discountError } = await admin
      .from('parent_percentage_discounts')
      .select('percent_off')
      .eq('parent_id', user.id)
      .maybeSingle();
    
    const percentOff = discountData?.percent_off ?? 0;
    const discountAmount = percentOff > 0 ? totalPrice * (percentOff / 100) : 0;
    totalPrice = totalPrice - discountAmount;

    // Also apply discount to line items for Stripe
    if (percentOff > 0) {
      for (const item of lineItems) {
        const originalAmount = item.price_data.unit_amount;
        const discountedAmount = Math.round(originalAmount * (1 - percentOff / 100));
        item.price_data.unit_amount = discountedAmount;
        item.price_data.product_data.description = `${item.price_data.product_data.description} (${percentOff}% off)`;
      }
      // Update sessionMetadata prices too
      for (const meta of sessionMetadata) {
        meta.price = meta.price * (1 - percentOff / 100);
      }
    }

    // Check user's credit balance
    const creditBalance = await getUserCreditBalance(user.id, tenant.slug);
    const creditsToUse = Math.min(creditBalance, totalPrice);
    const amountToPay = totalPrice - creditsToUse;

    // If credits cover the full amount, register directly without Stripe
    if (amountToPay <= 0) {
      // Use credits for each session
      for (const meta of sessionMetadata) {
        await applyCredits({
          userId: user.id,
          amount: meta.price,
          sessionId: meta.session_id,
          description: `Session booking paid with credits`,
          tenantSlug: tenant.slug,
        });

        // Register the wrestler for the session
        await admin.from('session_participants').insert({
          session_id: meta.session_id,
          youth_wrestler_id: wrestlerId,
          parent_id: user.id,
          amount_paid: meta.price,
          payment_method: 'credit',
          status: 'confirmed',
        });

        // Update session participant count
        const session = sessions.find(s => s.id === meta.session_id);
        if (session) {
          await admin.from('sessions').update({
            current_participants: ((session as { current_participants?: number }).current_participants ?? 0) + 1,
          }).eq('id', meta.session_id);
        }
      }

      return NextResponse.json({ 
        success: true, 
        paidWithCredits: true,
        creditsUsed: creditsToUse,
        redirectUrl: `/cart/success?credits_used=${creditsToUse}&sessions=${sessionIds.length}`,
      });
    }

    const stripeEnabled = process.env.STRIPE_CHECKOUT_ENABLED === 'true';
    if (!stripeEnabled) {
      return NextResponse.json({ error: 'Online payment is not enabled' }, { status: 503 });
    }

    // Adjust line items if partial credit is used
    let adjustedLineItems = lineItems;
    if (creditsToUse > 0) {
      // Apply credit as a discount to the first item(s)
      let remainingCredit = creditsToUse;
      adjustedLineItems = lineItems.map((item, idx) => {
        if (remainingCredit <= 0) return item;
        const originalPrice = item.price_data.unit_amount / 100;
        const discount = Math.min(remainingCredit, originalPrice);
        remainingCredit -= discount;
        const newAmount = Math.round((originalPrice - discount) * 100);
        if (newAmount <= 0) {
          // This item is fully covered by credit, skip it
          return null;
        }
        return {
          ...item,
          price_data: {
            ...item.price_data,
            unit_amount: newAmount,
            product_data: {
              ...item.price_data.product_data,
              description: `${item.price_data.product_data.description} (Credit applied: $${discount.toFixed(2)})`,
            },
          },
        };
      }).filter(Boolean) as typeof lineItems;
    }

    const stripe = getStripeInstance(tenant.slug);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    
    const successUrl = `${baseUrl}/cart/success?stripe_cs={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/cart/checkout`;

    const idempotencyKey = `cart-checkout-${user.id}-${sessionIds.sort().join('-')}-${wrestlerId}-${Date.now()}`.slice(0, 255);

    const stripeSession = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: adjustedLineItems,
        metadata: {
          app: 'the-guild',
          tenant_slug: tenant.slug,
          cart_checkout: 'true',
          youth_wrestler_id: wrestlerId,
          parent_id: user.id,
          session_ids: sessionIds.join(','),
          session_prices: sessionMetadata.map(m => `${m.session_id}:${m.price}`).join(','),
          credits_to_use: creditsToUse.toString(),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: user.email ?? undefined,
      },
      { idempotencyKey }
    );

    if (!stripeSession.url) {
      return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 });
    }

    return NextResponse.json({ 
      checkoutUrl: stripeSession.url,
      creditsApplied: creditsToUse,
      totalAfterCredits: amountToPay,
    });
  } catch (e) {
    const err = e as Error;
    console.error('Cart checkout API error:', err.message, err.stack);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
