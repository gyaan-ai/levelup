/**
 * U.S. ZIP normalization for storage (5-digit or ZIP+4).
 * Strips non-digits; accepts 5 or 9 digits after cleaning.
 */

export function normalizeUsZipCode(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return null;
}

export function isValidUsZipCode(input: string): boolean {
  return normalizeUsZipCode(input) !== null;
}
