import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Permanently removes past sessions that never had registrations (no session_participants).
 * Status must still be scheduled or pending_payment — e.g. empty slot that was never filled.
 */
export async function purgeEmptyPastSessions(admin: SupabaseClient): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: candidates, error: selErr } = await admin
    .from('sessions')
    .select(
      `
      id,
      session_participants ( id )
    `
    )
    .lt('scheduled_datetime', nowIso)
    .in('status', ['scheduled', 'pending_payment'])
    .eq('current_participants', 0);

  if (selErr) {
    console.error('purgeEmptyPastSessions select:', selErr);
    return 0;
  }
  if (!candidates?.length) return 0;

  const emptyIds = candidates
    .filter((row: { session_participants?: { id: string }[] | null }) => {
      const parts = row.session_participants;
      return !Array.isArray(parts) || parts.length === 0;
    })
    .map((row: { id: string }) => row.id);

  if (emptyIds.length === 0) return 0;

  const { error: delErr } = await admin.from('sessions').delete().in('id', emptyIds);
  if (delErr) {
    console.error('purgeEmptyPastSessions delete:', delErr);
    return 0;
  }
  return emptyIds.length;
}
