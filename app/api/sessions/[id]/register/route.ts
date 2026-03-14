import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import { formatEST } from '@/lib/format-date';

/**
 * POST - Pay & register a youth wrestler for a session (public or invite_only).
 * - Session owner: add for free.
 * - Non-owner + early adopter entitlement (1 free small group): add for free and consume entitlement.
 * - Non-owner otherwise: Creates Stripe Checkout; on success webhook adds participant and marks paid.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as { youthWrestlerId: string };
    const { youthWrestlerId } = body;
    if (!youthWrestlerId) return NextResponse.json({ error: 'Missing youthWrestlerId' }, { status: 400 });

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, parent_id, athlete_id, join_policy, session_mode, session_type, partner_invite_code, current_participants, max_participants, price_per_participant, scheduled_datetime, status')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const s = session as {
      parent_id?: string;
      join_policy?: string;
      session_mode?: string;
      session_type?: string;
      current_participants?: number;
      max_participants?: number;
      price_per_participant?: number;
      scheduled_datetime?: string;
      status?: string;
    };

    const current = s.current_participants ?? 1;
    const max = s.max_participants ?? 2;
    if (current >= max) {
      return NextResponse.json({ error: 'Session is full' }, { status: 400 });
    }

    const isOwner = s.parent_id === user.id;

    if (isOwner) {
      const { data: yw } = await supabase
        .from('youth_wrestlers')
        .select('id, parent_id')
        .eq('id', youthWrestlerId)
        .single();
      const ywParentId = (yw as { parent_id?: string } | null)?.parent_id;
      const isPrimaryParent = yw && ywParentId === user.id;
      const { data: link } = !isPrimaryParent && yw
        ? await supabase.from('youth_wrestler_parents').select('id').eq('youth_wrestler_id', youthWrestlerId).eq('parent_id', user.id).maybeSingle()
        : { data: null };
      if (!yw || (!isPrimaryParent && !link)) {
        return NextResponse.json({ error: 'Youth wrestler not found or not yours' }, { status: 400 });
      }
      const { data: existing } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', sessionId)
        .eq('youth_wrestler_id', youthWrestlerId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'This wrestler is already in this session' }, { status: 409 });
      }
      const { error: insertErr } = await supabase.from('session_participants').insert({
        session_id: sessionId,
        youth_wrestler_id: youthWrestlerId,
        parent_id: user.id,
        paid: true,
        amount_paid: 0,
      });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      await supabase.from('sessions').update({ current_participants: current + 1, updated_at: new Date().toISOString() }).eq('id', sessionId);
      return NextResponse.json({ added: true });
    }

    if (s.join_policy !== 'public' && s.join_policy !== 'invite_only') {
      return NextResponse.json({ error: 'This session is not open for registration' }, { status: 400 });
    }
    if (!['scheduled', 'pending_payment'].includes(s.status ?? '')) {
      return NextResponse.json({ error: 'Session is not open for registration' }, { status: 400 });
    }

    const isSmallGroup = s.session_type === 'group' || s.session_type === 'small_group';
    const admin = createAdminClient(tenant.slug);

    // Early adopter: 1 free small group join (uses '2-athlete' entitlement)
    if (isSmallGroup) {
      const { data: entitlement } = await admin
        .from('early_adopter_entitlements')
        .select('id, remaining')
        .eq('parent_id', user.id)
        .eq('session_type', '2-athlete')
        .gt('remaining', 0)
        .limit(1)
        .maybeSingle();

      if (entitlement?.id && (entitlement.remaining ?? 0) > 0) {
        const { error: insertErr } = await admin.from('session_participants').insert({
          session_id: sessionId,
          youth_wrestler_id: youthWrestlerId,
          parent_id: user.id,
          paid: true,
          amount_paid: 0,
        });
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
        await admin.from('sessions').update({
          current_participants: current + 1,
          updated_at: new Date().toISOString(),
          early_adopter_entitlement_id: entitlement.id,
        }).eq('id', sessionId);
        // Do not decrement remaining: gold register free is unlimited until you expire it (set remaining to 0 in DB or Admin).
        return NextResponse.json({ added: true });
      }
    }

    const pricePer = s.price_per_participant ?? 0;
    if (pricePer <= 0) {
      return NextResponse.json({ error: 'Session has no price set for participants' }, { status: 400 });
    }

    const { data: yw } = await supabase
      .from('youth_wrestlers')
      .select('id, parent_id')
      .eq('id', youthWrestlerId)
      .single();
    const ywParentId = (yw as { parent_id?: string } | null)?.parent_id;
    const isPrimaryParent = yw && ywParentId === user.id;
    const { data: link } = !isPrimaryParent && yw
      ? await supabase.from('youth_wrestler_parents').select('id').eq('youth_wrestler_id', youthWrestlerId).eq('parent_id', user.id).maybeSingle()
      : { data: null };
    if (!yw || (!isPrimaryParent && !link)) {
      return NextResponse.json({ error: 'Youth wrestler not found or not yours' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('youth_wrestler_id', youthWrestlerId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'This wrestler is already registered for this session' }, { status: 409 });
    }

    const stripeEnabled = process.env.STRIPE_CHECKOUT_ENABLED === 'true';
    if (!stripeEnabled) {
      return NextResponse.json({ error: 'Online payment is not enabled' }, { status: 503 });
    }

    const amountCents = Math.round(pricePer * 100);
    if (amountCents < 50) {
      return NextResponse.json({ error: 'Minimum charge is $0.50' }, { status: 400 });
    }

    const stripe = getStripeInstance(tenant.slug);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const successUrl = `${baseUrl}/sessions/${sessionId}/register/confirmed`;
    const cancelUrl = req.headers.get('referer') || `${baseUrl}/training`;

    const dt = s.scheduled_datetime ? new Date(s.scheduled_datetime) : null;
    const desc = dt
      ? `Session on ${formatEST(dt, 'MMM d, yyyy')} at ${formatEST(dt, 'h:mm a')} – register one spot`
      : 'Register for session';

    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'The Guild – Session registration',
            description: desc,
          },
        },
      }],
      metadata: {
        app: 'the-guild',
        session_id: sessionId,
        youth_wrestler_id: youthWrestlerId,
        parent_id: user.id,
        register: 'true',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email ?? undefined,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (e) {
    console.error('Session register API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
