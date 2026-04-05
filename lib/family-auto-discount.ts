import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveDiscountPercentOff } from '@/lib/discount-codes';

const FAMILY_CODE = 'FAMILY10';

/**
 * Parent login emails that receive FAMILY10 on the account without entering a code (org allowlist).
 * Set `FAMILY10_AUTO_PARENT_EMAILS` in env (comma-separated, case-insensitive).
 */
export function parseFamilyAutoParentEmails(): Set<string> {
  const raw = process.env.FAMILY10_AUTO_PARENT_EMAILS ?? '';
  return new Set(
    raw.split(/[,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

export function emailHasFamilyAllowlist(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return parseFamilyAutoParentEmails().has(email.trim().toLowerCase());
}

/**
 * When true, only allowlisted emails may sign up or redeem with FAMILY10 (see `.env.example`).
 */
export function family10RedeemRestrictedToAllowlist(): boolean {
  return process.env.FAMILY10_REDEEM_ALLOWLIST_ONLY === 'true';
}

export function family10CodeBlockedForEmail(
  codeUpper: string,
  email: string | null | undefined
): boolean {
  if (codeUpper !== FAMILY_CODE || !family10RedeemRestrictedToAllowlist()) return false;
  return !emailHasFamilyAllowlist(email);
}

/**
 * When `FAMILY10_AUTO_PARENT_EMAILS` is non-empty, only those login emails get a percent
 * discount at checkout (cart, session register, bookings). Everyone else pays full price
 * even if `parent_percentage_discounts` still has a row (e.g. mistaken redeem).
 *
 * When `FAMILY10_REQUIRE_ALLOWLIST_FOR_CHECKOUT=true`, the same gate applies even if the
 * allowlist env is empty — so no one gets a percent discount until you add allowed emails.
 */
export function familyCheckoutGatedByAllowlist(): boolean {
  if (process.env.FAMILY10_REQUIRE_ALLOWLIST_FOR_CHECKOUT === 'true') {
    return true;
  }
  return parseFamilyAutoParentEmails().size > 0;
}

/**
 * Emergency: set `FAMILY10_DISABLE_ALL_CHECKOUT_PERCENT_OFF=true` to charge full price for everyone.
 */
export function familyCheckoutPercentDisabled(): boolean {
  return process.env.FAMILY10_DISABLE_ALL_CHECKOUT_PERCENT_OFF === 'true';
}

/**
 * Percent off applied at Stripe / UI. Respects allowlist gate and kill switch.
 */
export function effectivePercentOffForCheckout(
  percentOffFromDb: number | null | undefined,
  email: string | null | undefined
): number {
  if (familyCheckoutPercentDisabled()) return 0;
  const raw = percentOffFromDb != null ? Number(percentOffFromDb) : NaN;
  if (!Number.isFinite(raw) || raw < 1) return 0;
  const clamped = Math.min(100, Math.round(raw));
  if (familyCheckoutGatedByAllowlist() && !emailHasFamilyAllowlist(email)) {
    return 0;
  }
  return clamped;
}

/**
 * Idempotent: if this parent email is on the org allowlist and they have no `parent_percentage_discounts` row yet,
 * inserts FAMILY10 from `discount_codes`. Does not increment `discount_codes.redemptions` (org grant).
 */
export async function ensureAutoFamilyDiscountForParent(
  admin: SupabaseClient,
  parentId: string,
  email: string | null | undefined
): Promise<void> {
  if (!emailHasFamilyAllowlist(email)) return;

  const { data: existing } = await admin
    .from('parent_percentage_discounts')
    .select('id')
    .eq('parent_id', parentId)
    .maybeSingle();
  if (existing) return;

  const { data: codeRow, error: codeErr } = await admin
    .from('discount_codes')
    .select('id, code, percent_off')
    .eq('code', FAMILY_CODE)
    .maybeSingle();
  if (codeErr || !codeRow) {
    console.warn('[family-auto-discount] FAMILY10 missing in discount_codes:', codeErr?.message);
    return;
  }

  const percentOff = resolveDiscountPercentOff(codeRow.code, codeRow.percent_off) ?? 10;
  const { error: insErr } = await admin.from('parent_percentage_discounts').insert({
    parent_id: parentId,
    discount_code_id: codeRow.id,
    percent_off: percentOff,
  });
  if (insErr) {
    console.warn('[family-auto-discount] insert failed:', insErr.message);
  }
}
