/**
 * Resolve percent-off (1–100) for a row in `discount_codes`.
 *
 * 1. Uses `percent_off` from DB when present and valid (handles string/number from Postgres).
 * 2. Fallback: convention codes `FAMILY`, `FAMILY10`, `FAMILY15`, … when DB was never set.
 *
 * Does NOT infer percent for non-family patterns (e.g. GUILDLAUNCH) — those stay null so we
 * don't accidentally grant discounts when early-adopter-style rows exist without percent_off.
 */
export function resolveDiscountPercentOff(code: string, percentOffFromDb: unknown): number | null {
  const raw = percentOffFromDb != null && percentOffFromDb !== '' ? Number(percentOffFromDb) : NaN;
  if (!Number.isNaN(raw) && raw >= 1 && raw <= 100) {
    return Math.round(raw);
  }

  const c = String(code ?? '').trim().toUpperCase();
  if (c === 'FAMILY') {
    return 10;
  }
  const familyMatch = c.match(/^FAMILY(\d{1,3})$/);
  if (familyMatch) {
    const v = parseInt(familyMatch[1], 10);
    if (v >= 1 && v <= 100) return v;
  }

  return null;
}
