import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import { formatEST } from '@/lib/format-date';
import { createRegisterConfirmationToken } from '@/lib/confirmation-token';
import { createNotification } from '@/lib/notifications';
import { sendCoachNewSignupSms } from '@/lib/twilio';

/**
 * POST - Pay & register a youth wrestler for a session (public or invite_only).
 * - Session owner: add for free.
 * - Non-owner + small group + parent has early_adopter_entitlements (2-athlete, remaining > 0): add for free and decrement entitlement.
 * - Non-owner otherwise: Stripe Checkout (with FAMILY10 % off if parent has it); webhook adds participant.
 * Never default to free: free only when entitlement is explicitly found.
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
    const role = userData?.role;
    if (role !== 'parent' && role !== 'admin' && role !== 'coach' && role !== 'youth_wrestler') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as { youthWrestlerId: string };
    const { youthWrestlerId } = body;
    if (!youthWrestlerId) return NextResponse.json({ error: 'Missing youthWrestlerId' }, { status: 400 });
    if (role === 'youth_wrestler' && youthWrestlerId !== user.id) {
      return NextResponse.json({ error: 'Youth wrestlers can only register themselves' }, { status: 403 });
    }

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
      const coachId = (session as { athlete_id?: string }).athlete_id;
      const dt = s.scheduled_datetime;
      if (coachId && coachId !== user.id) {
        const dateStr = dt ? formatEST(new Date(dt), 'EEE MMM d, h:mm a') : 'your session';
        const admin = createAdminClient(tenant.slug);
        await createNotification(admin, {
          user_id: coachId,
          type: 'session_booked',
          title: 'Someone signed up for your session',
          body: `New signup for ${dateStr}. Check My sessions.`,
          data: { session_id: sessionId },
        }).catch((e) => console.warn('Register: coach notification failed', e));
        await sendCoachNewSignupSms(admin, coachId, dateStr).catch(() => {});
      }
      return NextResponse.json({ added: true });
    }

    if (s.join_policy !== 'public' && s.join_policy !== 'invite_only') {
      return NextResponse.json({ error: 'This session is not open for registration' }, { status: 400 });
    }
    if (!['scheduled', 'pending_payment'].includes(s.status ?? '')) {
      return NextResponse.json({ error: 'Session is not open for registration' }, { status: 400 });
    }

    const isSmallGroup =
      s.session_type === 'group' ||
      s.session_type === '2-athlete' ||
      s.session_type === 'small_group' ||
      (max >= 2 && s.session_type !== '1-on-1');
    const rawPrice = s.price_per_participant;
    const pricePer = rawPrice != null && rawPrice > 0 ? rawPrice : 30;

    const isSelf = role === 'youth_wrestler' && youthWrestlerId === user.id;

    const { data: yw } = await supabase
      .from('youth_wrestlers')
      .select('id, parent_id')
      .eq('id', youthWrestlerId)
      .single();
    const ywParentId = (yw as { parent_id?: string } | null)?.parent_id;
    const isPrimaryParent = yw && ywParentId === user.id;
    const { data: link } = !isPrimaryParent && !isSelf && yw
      ? await supabase.from('youth_wrestler_parents').select('id').eq('youth_wrestler_id', youthWrestlerId).eq('parent_id', user.id).maybeSingle()
      : { data: null };
    if (!yw || (!isPrimaryParent && !link && !isSelf)) {
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

    // Free path only when parent has verified early-adopter entitlement (never default to free)
    const admin = createAdminClient(tenant.slug);
    if (isSmallGroup) {
      const { data: entitlement } = await admin
        .from('early_adopter_entitlements')
        .select('id, remaining')
        .eq('parent_id', user.id)
        .eq('session_type', '2-athlete')
        .gt('remaining', 0)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (entitlement && (entitlement as { remaining?: number }).remaining != null) {
        const { error: insertErr } = await supabase.from('session_participants').insert({
          session_id: sessionId,
          youth_wrestler_id: youthWrestlerId,
          parent_id: user.id,
          paid: true,
          amount_paid: 0,
        });
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
        await supabase.from('sessions').update({ current_participants: current + 1, updated_at: new Date().toISOString() }).eq('id', sessionId);
        const newRemaining = Math.max(0, ((entitlement as { remaining?: number }).remaining ?? 1) - 1);
        await admin.from('early_adopter_entitlements').update({ remaining: newRemaining, updated_at: new Date().toISOString() }).eq('id', entitlement.id);
        const coachId = (session as { athlete_id?: string }).athlete_id;
        const dt = s.scheduled_datetime;
        if (coachId && coachId !== user.id) {
          const dateStr = dt ? formatEST(new Date(dt), 'EEE MMM d, h:mm a') : 'your session';
          await createNotification(admin, {
            user_id: coachId,
            type: 'session_booked',
            title: 'Someone signed up for your session',
            body: `New signup for ${dateStr}. Check My sessions.`,
            data: { session_id: sessionId },
          }).catch((e) => console.warn('Register: coach notification failed', e));
          await sendCoachNewSignupSms(admin, coachId, dateStr).catch(() => {});
        }
        return NextResponse.json({ added: true });
      }
    }

    const stripeEnabled = process.env.STRIPE_CHECKOUT_ENABLED === 'true';
    if (!stripeEnabled) {
      return NextResponse.json({ error: 'Online payment is not enabled' }, { status: 503 });
    }

    // Family / percentage discount (e.g. 10% off)
    const admin = createAdminClient(tenant.slug);
    const { data: pctDiscount } = await admin
      .from('parent_percentage_discounts')
      .select('percent_off')
      .eq('parent_id', user.id)
      .maybeSingle();
    const percentOff = pctDiscount?.percent_off != null ? Number(pctDiscount.percent_off) : 0;
    const priceAfterDiscount = percentOff >= 1 && percentOff <= 100
      ? pricePer * (1 - percentOff / 100)
      : pricePer;

    const amountCents = Math.round(priceAfterDiscount * 100);
    if (amountCents < 50) {
      return NextResponse.json({ error: 'Minimum charge is $0.50' }, { status: 400 });
    }

    const stripe = getStripeInstance(tenant.slug);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const confirmToken = createRegisterConfirmationToken(sessionId);
    const successUrl = `${baseUrl}/sessions/${sessionId}/register/confirmed?t=${encodeURIComponent(confirmToken)}`;
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
