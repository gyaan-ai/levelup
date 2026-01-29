import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeInstance, getWebhookSecret } from '@/lib/stripe/webhooks';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
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
      if (app !== 'the-crew' || !sessionId) {
        return NextResponse.json({ received: true });
      }

      const supabase = createAdminClient(tenant.slug);
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          status: 'scheduled',
          athlete_paid: true,
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
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Stripe webhook error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
