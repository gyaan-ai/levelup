import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

/**
 * Stripe Checkout collects `customer_details.name` (cardholder), but we often only store email on `users`.
 * When `users.first_name` and `last_name` are both empty, copy the name from a completed Checkout session
 * so admin lists and profiles show real names after the first paid checkout.
 */
export async function maybeBackfillUserNameFromCheckoutSession(
  supabase: SupabaseClient,
  userId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  try {
    const raw = session.customer_details?.name?.trim();
    if (!raw) return;
    const { data: row } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle();
    if (!row) return;
    if (row.first_name?.trim() || row.last_name?.trim()) return;
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return;
    const first_name = parts[0];
    const last_name = parts.length > 1 ? parts.slice(1).join(' ') : null;
    await supabase.from('users').update({ first_name, last_name }).eq('id', userId);
  } catch (e) {
    console.warn('maybeBackfillUserNameFromCheckoutSession:', e);
  }
}
