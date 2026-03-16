import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeInstance, getWebhookSecret } from '@/lib/stripe/webhooks';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import { formatEST } from '@/lib/format-date';
import { headers } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
    }

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host) ?? { slug: 'nc-united' };
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
      const sessionId = session.metadata?.session_id;
      const app = session.metadata?.app;
      if (app !== 'the-guild' || !sessionId) {
        return NextResponse.json({ received: true });
      }

      const supabase = createAdminClient(tenant.slug);
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      const amountTotal = session.amount_total ?? 0;
      const isFreeOrder = amountTotal === 0;
      const earlyAdopterEntitlementId = session.metadata?.early_adopter_entitlement_id;
      const isRegisterPayment = session.metadata?.register === 'true';
      const youthWrestlerId = session.metadata?.youth_wrestler_id;
      const parentId = session.metadata?.parent_id;

      if (isRegisterPayment && youthWrestlerId && parentId) {
        const amountPaid = amountTotal / 100;
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
          const { error: insertErr } = await supabase.from('session_participants').insert({
            session_id: sessionId,
            youth_wrestler_id: youthWrestlerId,
            parent_id: parentId,
            paid: true,
            amount_paid: amountPaid,
          });
          if (insertErr) {
            console.error('Webhook: failed to insert session_participant (register)', insertErr);
            return NextResponse.json({ error: 'Failed to add participant' }, { status: 500 });
          }
          const { error: upErr } = await supabase
            .from('sessions')
            .update({ current_participants: current + 1, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
          if (upErr) {
            console.error('Webhook: failed to increment current_participants', upErr);
          }
        } else {
          await supabase
            .from('session_participants')
            .update({ paid: true, amount_paid: amountPaid })
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
            body: `New booking for ${dateStr}. Check your Sessions tab.`,
            data: { session_id: sessionId },
          }).catch((e) => console.warn('Webhook: coach notification failed', e));
        }
        return NextResponse.json({ received: true });
      }

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
          body: `Someone booked ${dateStr}. Check your Sessions tab.`,
          data: { session_id: sessionId },
        }).catch((e) => console.warn('Webhook: coach notification failed', e));
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
