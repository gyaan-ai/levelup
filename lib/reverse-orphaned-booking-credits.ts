import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

type RpcResult = {
  restoredUsd?: unknown;
  reversedUsageRowCount?: unknown;
};

/**
 * Credits were historically applied before `session_participants` insert. If the insert failed,
 * `credit_usage` still recorded a debit while the parent has no row on that session — restore
 * `credits.remaining` and remove those usage rows.
 *
 * Implemented in Postgres (`admin_reverse_orphaned_booking_credits`) so refund + deletes are one
 * transaction. Only reverses usage for sessions where this parent has **zero** participants.
 */
export async function reverseOrphanedBookingCredits(
  admin: SupabaseClient,
  parentId: string
): Promise<{ restoredUsd: number; reversedUsageRowCount: number }> {
  const { data, error } = await admin.rpc('admin_reverse_orphaned_booking_credits', {
    p_parent_id: parentId,
  });
  if (error) throw new Error(error.message);
  const row = data as RpcResult | null;
  return {
    restoredUsd: Number(row?.restoredUsd ?? 0),
    reversedUsageRowCount: Number(row?.reversedUsageRowCount ?? 0),
  };
}

export async function reverseOrphanedBookingCreditsForTenant(
  parentId: string,
  tenantSlug: string
): Promise<{ restoredUsd: number; reversedUsageRowCount: number }> {
  const admin = createAdminClient(tenantSlug);
  return reverseOrphanedBookingCredits(admin, parentId);
}
