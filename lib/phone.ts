/**
 * Shared validation for US-style cell numbers stored as arbitrary strings (digits + formatting).
 */

/** True if value has at least `minDigits` numeric digits (default 10). */
export function hasMinPhoneDigits(value: string | null | undefined, minDigits = 10): boolean {
  if (value == null || typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= minDigits;
}

/** Required athlete/parent-supplied cell for youth wrestler create/update. */
export function validateRequiredYouthPhone(raw: unknown):
  | { ok: true; phone: string }
  | { ok: false; message: string } {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: false, message: 'Cell phone is required' };
  }
  const s = String(raw).trim();
  if (!hasMinPhoneDigits(s)) {
    return { ok: false, message: 'Enter a valid cell number (at least 10 digits)' };
  }
  return { ok: true, phone: s };
}
