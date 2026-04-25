import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_MIN_AGE_HOURS = 36;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Parent book-a-coach + deferred Stripe creates a `sessions` row before checkout completes.
 * If the parent never pays, the row stays scheduled with no roster. Cancel those shells after
 * `minAgeHours` (default 36h — past typical Checkout expiry + webhook delay).
 *
 * Coach-posted sessions use parent_id === athlete_id and are never selected.
 * Rows with any session_participants are skipped (legacy / in-flight paths).
 */
export async function cancelAbandonedBookingCheckoutSessions(
  admin: SupabaseClient,
  minAgeHours: number = DEFAULT_MIN_AGE_HOURS
): Promise<number> {
  const hours = Math.max(6, minAgeHours);
  const cutoffIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from('sessions')
    .select('id, parent_id, athlete_id')
    .eq('status', 'scheduled')
    .eq('athlete_paid', false)
    .eq('current_participants', 0)
    .lt('created_at', cutoffIso)
    .not('parent_id', 'is', null)
    .limit(1000);

  if (error) {
    console.error('cancelAbandonedBookingCheckoutSessions select:', error);
    return 0;
  }

  const shellIds = (rows ?? [])
    .filter((r) => {
      const row = r as { parent_id?: string | null; athlete_id?: string | null };
      const pid = row.parent_id ?? null;
      const aid = row.athlete_id ?? null;
      return Boolean(pid && aid && pid !== aid);
    })
    .map((r) => (r as { id: string }).id);

  if (shellIds.length === 0) return 0;

  const { data: partRows, error: partErr } = await admin
    .from('session_participants')
    .select('session_id')
    .in('session_id', shellIds);

  if (partErr) {
    console.error('cancelAbandonedBookingCheckoutSessions participants:', partErr);
    return 0;
  }

  const withParticipants = new Set(
    (partRows ?? []).map((p) => (p as { session_id: string }).session_id)
  );
  const toCancel = shellIds.filter((id) => !withParticipants.has(id));
  if (toCancel.length === 0) return 0;

  let cancelled = 0;
  const now = new Date().toISOString();
  for (const batch of chunk(toCancel, 200)) {
    const { data: updated, error: upErr } = await admin
      .from('sessions')
      .update({ status: 'cancelled', updated_at: now })
      .in('id', batch)
      .eq('status', 'scheduled')
      .eq('athlete_paid', false)
      .select('id');

    if (upErr) {
      console.error('cancelAbandonedBookingCheckoutSessions update:', upErr);
      continue;
    }
    cancelled += updated?.length ?? 0;
  }

  return cancelled;
}
