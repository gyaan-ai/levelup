/**
 * Canonical parent price per spot from `sessions.price_per_participant`.
 * **Explicit 0** = free/comp (no Stripe for that portion). Missing/invalid falls back so legacy sessions still behave.
 */
export function sessionPricePerParticipantUsd(
  raw: number | null | undefined,
  fallbackWhenMissing = 30
): number {
  if (raw == null) return fallbackWhenMissing;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallbackWhenMissing;
  return Math.max(0, n);
}
