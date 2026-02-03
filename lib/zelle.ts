/**
 * Zelle accepts email or phone. Phone numbers: accept any format with 7+ digits,
 * normalize to standard XXX-XXX-XXXX (10-digit) or XXX-XXXX (7-digit).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PHONE_DIGITS = 7;

/** Extract digits from string */
export function extractDigits(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Normalize Zelle input (email or phone) to standard format.
 * - Email: return trimmed as-is if valid
 * - Phone: extract digits, require 7+, format as XXX-XXX-XXXX (10) or XXX-XXXX (7)
 * Returns null if invalid.
 */
export function normalizeZelleInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return EMAIL_RE.test(trimmed) ? trimmed : null;
  }

  const digits = extractDigits(trimmed);
  if (digits.length < MIN_PHONE_DIGITS) return null;

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  // 8, 9, 11+ digits: store digits only as fallback
  return digits;
}

/** Check if value is valid Zelle (email or 7+ digit phone) */
export function isValidZelle(value: string): boolean {
  return normalizeZelleInput(value) !== null;
}
