/**
 * Whether to show Copy Cell #s + Text group for a session (coach or admin).
 * Group-style sessions with at least one signup.
 */
export function showSessionSmsCopyAndTextGroup(session: {
  current_participants?: number;
  max_participants?: number;
  session_type?: string;
  session_mode?: string;
}): boolean {
  const current = session.current_participants ?? 0;
  if (current < 1) return false;
  const st = session.session_type ?? '';
  const mode = session.session_mode ?? '';
  const max = session.max_participants ?? 1;
  if (st === 'small_group' || st === 'group' || st === '2-athlete') return true;
  if (max > 1) return true;
  if (mode === 'partner-open' || mode === 'partner-invite') return true;
  return false;
}
