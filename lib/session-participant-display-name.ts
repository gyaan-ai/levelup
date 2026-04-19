/**
 * Roster display names on session_participants rows.
 * Prefer live youth_wrestlers join; fall back to roster_* snapshots (RLS-safe).
 */

export type SessionParticipantNameRow = {
  youth_wrestlers?:
    | { id?: string; first_name?: string | null; last_name?: string | null }
    | Array<{ id?: string; first_name?: string | null; last_name?: string | null }>
    | null;
  roster_first_name?: string | null;
  roster_last_name?: string | null;
};

export function displayNameFromSessionParticipant(p: SessionParticipantNameRow): string | null {
  const yw = p.youth_wrestlers;
  const o = Array.isArray(yw) ? yw[0] : yw;
  if (o && (o.first_name || o.last_name)) {
    const s = [o.first_name, o.last_name].filter(Boolean).join(' ').trim();
    return s || null;
  }
  const rf = p.roster_first_name?.trim();
  const rl = p.roster_last_name?.trim();
  if (rf || rl) return [rf, rl].filter(Boolean).join(' ').trim();
  return null;
}

export function sessionParticipantDisplayNames(
  parts: SessionParticipantNameRow[] | null | undefined
): string[] {
  if (!Array.isArray(parts)) return [];
  return parts.map(displayNameFromSessionParticipant).filter((n): n is string => Boolean(n));
}
