import { getStripeInstance } from '@/lib/stripe/webhooks';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenants } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import { sendCoachNewSignupSms } from '@/lib/twilio';
import { formatEST } from '@/lib/format-date';
import { rosterSnapshotFromYouthRow } from '@/lib/session-roster-snapshot';

/**
 * Idempotent: same logic as Stripe webhook `checkout.session.completed` for register payments.
 * Call from the register-confirmed page when `stripe_cs={CHECKOUT_SESSION_ID}` is present so the
 * participant row exists even if the webhook is slow or fails.
 *
 * `checkoutSessionId` first — tenant comes from Checkout metadata (`tenant_slug`) when present
 * so we still write to the right Supabase if Host / getTenantByDomain failed (paid-in-Stripe, no row).
 */
export async function finalizeRegisterFromCheckoutSession(
  checkoutSessionId: string,
  tenantSlugHint?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const stripe = getStripeInstance(tenantSlugHint ?? 'guild');
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const sessionId = session.metadata?.session_id;
    const app = session.metadata?.app;
    const isRegisterPayment = session.metadata?.register === 'true';
    const youthWrestlerId = session.metadata?.youth_wrestler_id;
    const parentId = session.metadata?.parent_id;

    if (app !== 'the-guild' || !sessionId || !isRegisterPayment || !youthWrestlerId || !parentId) {
      return { ok: false, error: 'Not a Guild register checkout' };
    }
    if (session.payment_status !== 'paid') {
      return { ok: false, error: 'Payment not completed' };
    }

    const metaSlug = (session.metadata?.tenant_slug as string | undefined)?.trim().toLowerCase();
    const tenantSlug =
      metaSlug && tenants[metaSlug as keyof typeof tenants]
        ? metaSlug
        : tenantSlugHint ?? 'guild';

    const amountTotal = session.amount_total ?? 0;
    const amountPaid = amountTotal / 100;
    const supabase = createAdminClient(tenantSlug);

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
        ...rosterSnapshotFromYouthRow((ywSnap ?? {}) as { first_name?: string; last_name?: string; photo_url?: string }),
      });
      if (insertErr) {
        if (insertErr.code === '23505') {
          await supabase
            .from('session_participants')
            .update({ paid: true, amount_paid: amountPaid })
            .eq('session_id', sessionId)
            .eq('youth_wrestler_id', youthWrestlerId);
          return { ok: true };
        }
        console.error('finalizeRegisterFromCheckoutSession: insert failed', insertErr);
        return { ok: false, error: insertErr.message };
      }
      await supabase
        .from('sessions')
        .update({ current_participants: current + 1, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

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
        }).catch((e) => console.warn('finalizeRegister: coach notification failed', e));
        await sendCoachNewSignupSms(supabase, coachId, dateStr).catch(() => {});
      }
    } else {
      await supabase
        .from('session_participants')
        .update({ paid: true, amount_paid: amountPaid })
        .eq('session_id', sessionId)
        .eq('youth_wrestler_id', youthWrestlerId);
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('finalizeRegisterFromCheckoutSession:', e);
    return { ok: false, error: msg };
  }
}
