import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Permanently removes past sessions with zero kids on the roster (`session_participants`).
 * Implemented in Postgres (NOT EXISTS) so it scales; ignores `current_participants` drift.
 */
export async function purgeEmptyPastSessions(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc('purge_empty_past_sessions');
  if (error) {
    console.error('purgeEmptyPastSessions rpc:', error);
    return 0;
  }
  if (data == null) return 0;
  return typeof data === 'bigint' ? Number(data) : Number(data);
}
