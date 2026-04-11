import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveDiscountPercentOff } from '@/lib/discount-codes';
import {
  effectivePercentOffForCheckout,
  emailHasFamilyAllowlist,
  family10CodeBlockedForEmail,
  parseFamilyAutoParentEmails,
} from '@/lib/family-auto-discount';

/**
 * When false (default), Stripe/cart/session-register/bookings use ONLY a promo code sent
 * in the API body for this payment — never a silent row in `parent_percentage_discounts`.
 * Set `CHECKOUT_PERCENT_ALLOW_SAVED_ACCOUNT_DISCOUNT=true` to restore old behavior
 * (account-level percent applies automatically at checkout).
 */
export function checkoutAllowSavedAccountPercent(): boolean {
  return process.env.CHECKOUT_PERCENT_ALLOW_SAVED_ACCOUNT_DISCOUNT === 'true';
}

/**
 * Read-only: valid percent (1–100) for this code and user, or 0. Does not insert rows or bump redemptions.
 */
export async function resolvePromoCodePercentForCheckout(
  admin: SupabaseClient,
  promoCodeRaw: string | null | undefined,
  userEmail: string | null | undefined
): Promise<number> {
  const codeNorm = typeof promoCodeRaw === 'string' ? promoCodeRaw.trim().toUpperCase() : '';
  if (!codeNorm) return 0;

  const { data: codeRow, error } = await admin
    .from('discount_codes')
    .select('id, code, max_redemptions, redemptions, active, percent_off')
    .eq('code', codeNorm)
    .maybeSingle();

  if (error || !codeRow || codeRow.active === false) return 0;

  const max = codeRow.max_redemptions;
  const current = codeRow.redemptions ?? 0;
  if (max != null && current >= max) return 0;

  if (family10CodeBlockedForEmail(codeNorm, userEmail)) return 0;

  const po = resolveDiscountPercentOff(codeRow.code, codeRow.percent_off);
  if (po == null || po < 1 || po > 100) return 0;
  return Math.round(po);
}

const FAMILY10 = 'FAMILY10';

/**
 * Promo-only checkout: if this login email is in `FAMILY10_AUTO_PARENT_EMAILS` and they did not
 * send another code, apply FAMILY10 automatically (validated like a typed code). No DB row needed.
 * Does nothing when the allowlist env is empty — avoids surprising defaults.
 */
export async function implicitAllowlistFamilyPercentAtCheckout(
  admin: SupabaseClient,
  email: string | null | undefined
): Promise<number> {
  if (parseFamilyAutoParentEmails().size === 0) return 0;
  if (!emailHasFamilyAllowlist(email)) return 0;
  return resolvePromoCodePercentForCheckout(admin, FAMILY10, email);
}

/**
 * Percent off shown on cart / join / register before pay (promo-only mode). Explicit promo wins;
 * else allowlisted parents get implicit FAMILY10 for display matching Stripe.
 */
export async function displayPercentForPromoOnlyCheckout(
  admin: SupabaseClient,
  email: string | null | undefined
): Promise<number> {
  const implicit = await implicitAllowlistFamilyPercentAtCheckout(admin, email);
  return implicit >= 1 ? implicit : 0;
}

/**
 * Percent off for payment: either saved row (legacy) or promo code on this request only.
 */
export async function resolveCheckoutPercentOff(
  admin: SupabaseClient,
  opts: {
    savedPercent: number | null | undefined;
    email: string | null | undefined;
    promoCode: string | null | undefined;
  }
): Promise<number> {
  if (checkoutAllowSavedAccountPercent()) {
    return effectivePercentOffForCheckout(opts.savedPercent, opts.email);
  }
  const fromPromo = await resolvePromoCodePercentForCheckout(admin, opts.promoCode, opts.email);
  if (fromPromo >= 1) return fromPromo;
  return implicitAllowlistFamilyPercentAtCheckout(admin, opts.email);
}
