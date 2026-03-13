import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns youth wrestler IDs that this user can see as a parent:
 * - Wrestlers where they are the primary parent (parent_id = userId)
 * - Wrestlers where they are a linked parent (youth_wrestler_parents)
 * Use this on all parent-facing pages so parents only ever see their own wrestlers,
 * regardless of RLS or role edge cases.
 */
export async function getParentYouthWrestlerIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const [primaryRes, linkedRes] = await Promise.all([
    supabase.from('youth_wrestlers').select('id').eq('parent_id', userId),
    supabase.from('youth_wrestler_parents').select('youth_wrestler_id').eq('parent_id', userId),
  ]);
  const primaryIds = (primaryRes.data ?? []).map((r: { id: string }) => r.id);
  const linkedIds = (linkedRes.data ?? []).map((r: { youth_wrestler_id: string }) => r.youth_wrestler_id);
  return [...new Set([...primaryIds, ...linkedIds])];
}
