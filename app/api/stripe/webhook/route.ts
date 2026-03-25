import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeInstance, getWebhookSecret } from '@/lib/stripe/webhooks';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain, tenants } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import { sendCoachNewSignupSms } from '@/lib/twilio';
import { formatEST } from '@/lib/format-date';
import { headers } from 'next/headers';
import { rosterSnapshotFromYouthRow } from '@/lib/session-roster-snapshot';

/**
 * Fetch the actual Stripe fee from a PaymentIntent's balance transaction.
 * Returns fee in dollars (not cents).
 */
async function getStripeFee(stripe: Stripe, paymentIntentId: string): Promise<number> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    if (bt?.fee) {
      return bt.fee / 100; // Convert cents to dollars
    }
  } catch (e) {
    console.warn('Failed to fetch Stripe fee:', e);
  }
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
    }

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host) ?? { slug: 'guild' };
    const webhookSecret = getWebhookSecret(tenant.slug);
    const stripe = getStripeInstance(tenant.slug);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
      console.error('Stripe webhook signature error:', message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const app = session.metadata?.app;
      const isCartCheckout = session.metadata?.cart_checkout === 'true';
      const sessionId = session.metadata?.session_id;
      const sessionIds = session.metadata?.session_ids?.split(',').filter(Boolean) || [];
      
      if (app !== 'the-guild') {
        return NextResponse.json({ received: true });
      }
      
      // Handle cart checkout (multiple sessions)
      if (isCartCheckout && sessionIds.length > 0) {
        const youthWrestlerId = session.metadata?.youth_wrestler_id;
        const parentId = session.metadata?.parent_id;
        const sessionPrices = session.metadata?.session_prices?.split(',') || [];
        const creditsUsed = parseFloat(session.metadata?.credits_to_use || '0');
        
        if (!youthWrestlerId || !parentId) {
          console.error('Cart checkout webhook: missing youth_wrestler_id or parent_id', session.metadata);
          return NextResponse.json({ error: 'Missing wrestler/parent metadata' }, { status: 500 });
        }
        
        const rawMetaTenant = (session.metadata?.tenant_slug as string | undefined)?.trim().toLowerCase();
        const tenantSlug = rawMetaTenant && rawMetaTenant in tenants ? rawMetaTenant : 'guild';
        const supabase = createAdminClient(tenantSlug);
        
        // Get actual Stripe fee for this checkout
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        const totalStripeFee = paymentIntentId ? await getStripeFee(stripe, paymentIntentId) : 0;
        // Distribute fee proportionally across sessions based on price
        const totalPrice = sessionPrices.reduce((sum, p) => sum + parseFloat(p.split(':')[1] || '0'), 0);
        
        // Process each session in the cart
        for (const sid of sessionIds) {
          // Parse price for this session
          const priceEntry = sessionPrices.find(p => p.startsWith(`${sid}:`));
          const amountPaid = priceEntry ? parseFloat(priceEntry.split(':')[1]) : 0;
          // Proportional Stripe fee for this session
          const sessionStripeFee = totalPrice > 0 ? (amountPaid / totalPrice) * totalStripeFee : 0;
          
          // Check if already registered
          const { data: existing } = await supabase
            .from('session_participants')
            .select('id')
            .eq('session_id', sid)
            .eq('youth_wrestler_id', youthWrestlerId)
            .maybeSingle();
          
          if (!existing) {
            // Get current participant count
            const { data: sess } = await supabase
              .from('sessions')
              .select('current_participants, athlete_id, scheduled_datetime')
              .eq('id', sid)
              .single();
            const current = (sess as { current_participants?: number } | null)?.current_participants ?? 0;
            
            // Insert participant with Stripe tracking
            const { error: insertErr } = await supabase.from('session_participants').insert({
              session_id: sid,
              youth_wrestler_id: youthWrestlerId,
              parent_id: parentId,
              paid: true,
              amount_paid: amountPaid,
              stripe_payment_intent_id: paymentIntentId,
              stripe_fee: sessionStripeFee,
            });
            
if (insertErr) {
            if (insertErr.code === '23505') {
              // Duplicate - just update with Stripe data
              await supabase
                .from('session_participants')
                .update({ paid: true, amount_paid: amountPaid, stripe_payment_intent_id: paymentIntentId, stripe_fee: sessionStripeFee })
                .eq('session_id', sid)
                .eq('youth_wrestler_id', youthWrestlerId);
            } else {
                console.error('Cart webhook: failed to insert participant', insertErr, { sid, youthWrestlerId });
              }
            } else {
              // Update participant count
              await supabase
                .from('sessions')
                .update({ current_participants: current + 1, updated_at: new Date().toISOString() })
                .eq('id', sid);
            }
            
            // Notify coach
            const coachId = (sess as { athlete_id?: string } | null)?.athlete_id;
            const dt = (sess as { scheduled_datetime?: string } | null)?.scheduled_datetime;
            if (coachId) {
              const dateStr = dt ? formatEST(new Date(dt), 'EEE MMM d, h:mm a') : 'your session';
              await createNotification(supabase, {
                user_id: coachId,
                type: 'session_booked',
                title: 'Someone just booked your session',
                body: `New booking for ${dateStr}. Check My sessions.`,
                data: { session_id: sid },
              }).catch((e) => console.warn('Cart webhook: coach notification failed', e));
              await sendCoachNewSignupSms(supabase, coachId, dateStr).catch(() => {});
            }
          } else {
            // Update existing with Stripe data
            await supabase
              .from('session_participants')
              .update({ paid: true, amount_paid: amountPaid, stripe_payment_intent_id: paymentIntentId, stripe_fee: sessionStripeFee })
              .eq('session_id', sid)
              .eq('youth_wrestler_id', youthWrestlerId);
          }
        }
        
        // Deduct credits if used
        if (creditsUsed > 0) {
          const { applyCredits } = await import('@/lib/credits');
          await applyCredits({
            userId: parentId,
            amount: creditsUsed,
            sessionId: sessionIds[0], // Use first session as reference
            description: `Cart checkout for ${sessionIds.length} sessions`,
            tenantSlug,
          });
        }
        
        console.log('Cart checkout webhook completed:', { sessionIds, youthWrestlerId, parentId, creditsUsed });
        return NextResponse.json({ received: true });
      }
      
      // Single session checkout (original flow)
      if (!sessionId) {
        return NextResponse.json({ received: true });
      }

      /** Prefer Checkout metadata — Host on webhook requests can be wrong / not in getTenantByDomain. */
      const rawMetaTenant = (session.metadata?.tenant_slug as string | undefined)?.trim().toLowerCase();
      const tenantSlug =
        rawMetaTenant && rawMetaTenant in tenants
          ? rawMetaTenant
          : (getTenantByDomain(host) ?? { slug: 'guild' }).slug;
      const supabase = createAdminClient(tenantSlug);
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      const amountTotal = session.amount_total ?? 0;
      const isFreeOrder = amountTotal === 0;
      const earlyAdopterEntitlementId = session.metadata?.early_adopter_entitlement_id;
      const isRegisterPayment = session.metadata?.register === 'true';
      const youthWrestlerId = session.metadata?.youth_wrestler_id;
      const parentId = session.metadata?.parent_id;

      /** Register checkouts MUST NOT fall through to the “private booking” path — that only updates `sessions`, never adds roster rows. */
      if (isRegisterPayment) {
        if (!youthWrestlerId || !parentId) {
          console.error('Stripe webhook: register=true but missing youth_wrestler_id or parent_id', {
            sessionId,
            stripeCheckoutId: session.id,
            metadata: session.metadata,
          });
          return NextResponse.json(
            { error: 'Register checkout missing wrestler/parent metadata' },
            { status: 500 }
          );
        }
        const amountPaid = amountTotal / 100;
        // Fetch actual Stripe fee
        const stripeFee = paymentIntentId ? await getStripeFee(stripe, paymentIntentId) : 0;
        
        const { data: existing } = await supabase
          .from('session_participants')
          .select('id')
          .eq('session_id', sessionId)
          .eq('youth_wrestler_id', youthWrestlerId)
          .maybeSingle();
        if (!existing) {
          const { data: sess } = await supabase
            .from('sessions')
            .select('current_participants')
            .eq('id', sessionId)
            .single();
          const current = (sess as { current_participants?: number } | null)?.current_participants ?? 0;
          const { data: ywSnap } = await supabase
            .from('youth_wrestlers')
            .select('first_name, last_name, photo_url')
            .eq('id', youthWrestlerId)
            .maybeSingle();
          const { error: insertErr } = await supabase.from('session_participants').insert({
            session_id: sessionId,
            youth_wrestler_id: youthWrestlerId,
            parent_id: parentId,
            paid: true,
            amount_paid: amountPaid,
            stripe_payment_intent_id: paymentIntentId,
            stripe_fee: stripeFee,
            ...rosterSnapshotFromYouthRow((ywSnap ?? {}) as { first_name?: string; last_name?: string; photo_url?: string }),
          });
          if (insertErr) {
            // Concurrent webhook deliveries or Stripe retries: two workers both saw "no row" — second insert loses UNIQUE race.
            if (insertErr.code === '23505') {
              await supabase
                .from('session_participants')
                .update({ paid: true, amount_paid: amountPaid, stripe_payment_intent_id: paymentIntentId, stripe_fee: stripeFee })
                .eq('session_id', sessionId)
                .eq('youth_wrestler_id', youthWrestlerId);
            } else {
              console.error('Webhook: failed to insert session_participant (register)', {
                code: insertErr.code,
                message: insertErr.message,
                details: insertErr.details,
                hint: insertErr.hint,
                sessionId,
                youthWrestlerId,
                parentId,
              });
              return NextResponse.json(
                { error: 'Failed to add participant', code: insertErr.code, message: insertErr.message },
                { status: 500 }
              );
            }
          } else {
            const { error: upErr } = await supabase
              .from('sessions')
              .update({ current_participants: current + 1, updated_at: new Date().toISOString() })
              .eq('id', sessionId);
            if (upErr) {
              console.error('Webhook: failed to increment current_participants', upErr);
            }
          }
        } else {
          await supabase
            .from('session_participants')
            .update({ paid: true, amount_paid: amountPaid, stripe_payment_intent_id: paymentIntentId, stripe_fee: stripeFee })
            .eq('session_id', sessionId)
            .eq('youth_wrestler_id', youthWrestlerId);
        }
        // Notify coach so they see it (college kids need reminders)
        const { data: sessRow } = await supabase
          .from('sessions')
          .select('athlete_id, scheduled_datetime')
          .eq('id', sessionId)
          .single();
        const coachId = (sessRow as { athlete_id?: string } | null)?.athlete_id;
        const dt = (sessRow as { scheduled_datetime?: string } | null)?.scheduled_datetime;
        if (coachId) {
          const dateStr = dt ? formatEST(new Date(dt), 'EEE MMM d, h:mm a') : 'your session';
          await createNotification(supabase, {
            user_id: coachId,
            type: 'session_booked',
            title: 'Someone just booked your session',
            body: `New booking for ${dateStr}. Check My sessions.`,
            data: { session_id: sessionId },
          }).catch((e) => console.warn('Webhook: coach notification failed', e));
          await sendCoachNewSignupSms(supabase, coachId, dateStr).catch(() => {});
        }
        return NextResponse.json({ received: true });
      }

      /* --- Private / booking checkout (metadata.register is NOT set) --- */
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          status: 'scheduled',
          athlete_paid: !isFreeOrder,
          ...(paymentIntentId && { stripe_payment_intent_id: paymentIntentId }),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Webhook: failed to update session', sessionId, updateError);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }

      const { error: participantsError } = await supabase
        .from('session_participants')
        .update({ paid: true })
        .eq('session_id', sessionId);

      if (participantsError) {
        console.error('Webhook: failed to update session_participants', participantsError);
      }

      // Notify coach when parent pays for a session (e.g. private booking)
      const { data: sessRow } = await supabase
        .from('sessions')
        .select('athlete_id, scheduled_datetime')
        .eq('id', sessionId)
        .single();
      const coachId = (sessRow as { athlete_id?: string } | null)?.athlete_id;
      const dt = (sessRow as { scheduled_datetime?: string } | null)?.scheduled_datetime;
      if (coachId) {
        const dateStr = dt ? formatEST(new Date(dt), 'EEE MMM d, h:mm a') : 'your session';
        await createNotification(supabase, {
          user_id: coachId,
          type: 'session_booked',
          title: 'New booking',
          body: `Someone booked ${dateStr}. Check My sessions.`,
          data: { session_id: sessionId },
        }).catch((e) => console.warn('Webhook: coach notification failed', e));
        await sendCoachNewSignupSms(supabase, coachId, dateStr).catch(() => {});
      }

      if (earlyAdopterEntitlementId) {
        const { data: ent } = await supabase
          .from('early_adopter_entitlements')
          .select('remaining')
          .eq('id', earlyAdopterEntitlementId)
          .single();
        if (ent && (ent.remaining ?? 0) > 0) {
          await supabase
            .from('early_adopter_entitlements')
            .update({ remaining: (ent.remaining ?? 1) - 1 })
            .eq('id', earlyAdopterEntitlementId);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Stripe webhook error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
