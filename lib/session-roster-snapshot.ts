import type { SupabaseClient } from '@supabase/supabase-js';

/** Fields stored on session_participants so roster lists work under youth_wrestlers RLS. */
export type SessionRosterSnapshot = {
  roster_first_name: string | null;
  roster_last_name: string | null;
  roster_photo_url: string | null;
};

export function rosterSnapshotFromYouthRow(yw: {
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
}): SessionRosterSnapshot {
  return {
    roster_first_name: yw.first_name ?? null,
    roster_last_name: yw.last_name ?? null,
    roster_photo_url: yw.photo_url ?? null,
  };
}

/**
 * Writes roster snapshot after insert/update. Some production DBs missed the migration that adds
 * roster_* columns; inserts without those fields succeed, then this UPDATE no-ops on PGRST204.
 * When columns exist, names show correctly on public roster UIs.
 */
export async function maybeBackfillRosterSnapshot(
  admin: SupabaseClient,
  filter: { session_id: string; youth_wrestler_id: string },
  yw: { first_name?: string | null; last_name?: string | null; photo_url?: string | null }
): Promise<void> {
  const snap = rosterSnapshotFromYouthRow(yw);
  const { error } = await admin
    .from('session_participants')
    .update(snap)
    .eq('session_id', filter.session_id)
    .eq('youth_wrestler_id', filter.youth_wrestler_id);
  if (!error) return;
  if (error.code === 'PGRST204' || (error.message ?? '').includes('schema cache')) {
    return;
  }
  console.warn('[session_participants] roster backfill failed:', error.code, error.message);
}
