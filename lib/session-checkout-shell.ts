type ParticipantLike = { paid?: boolean | null };

/** Bookable / open session statuses (DB may still have legacy `pending_payment` until migration runs). */
export function isOpenSessionStatus(status: string | null | undefined): boolean {
  return status === 'scheduled' || status === 'pending_payment';
}

/**
 * True when the session is a parent-initiated booking that has not yet recorded any paid roster row.
 * Replaces reliance on `pending_payment` for revenue/capacity rules: coach-published sessions use
 * `parent_id === athlete_id` and are never treated as a checkout shell.
 */
export function isBookingCheckoutShellSession(s: {
  status: string;
  parent_id?: string | null;
  athlete_id?: string | null;
  session_participants?: ParticipantLike[] | ParticipantLike | null;
}): boolean {
  if (s.status === 'pending_payment') return true;
  if (s.status !== 'scheduled') return false;
  const pid = s.parent_id ?? '';
  const aid = s.athlete_id ?? '';
  if (!pid || !aid || pid === aid) return false;
  const raw = s.session_participants;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return !rows.some((p) => p.paid === true);
}
