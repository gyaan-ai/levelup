import type { SupabaseClient } from '@supabase/supabase-js';

export type ParentWrestlerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url?: string | null;
};

/**
 * Youth wrestlers the parent can book for: primary children + linked via youth_wrestler_parents.
 */
export async function getWrestlersForParentUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ParentWrestlerRow[]> {
  const { data: primaryRows, error: primaryErr } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name, photo_url')
    .eq('parent_id', userId);

  if (primaryErr) {
    console.error('getWrestlersForParentUser primary:', primaryErr.message);
  }

  const { data: linkedIds } = await supabase
    .from('youth_wrestler_parents')
    .select('youth_wrestler_id')
    .eq('parent_id', userId);

  const linkedIdList = [...new Set((linkedIds ?? []).map((r: { youth_wrestler_id: string }) => r.youth_wrestler_id))];

  const { data: linkedRows } =
    linkedIdList.length > 0
      ? await supabase
          .from('youth_wrestlers')
          .select('id, first_name, last_name, photo_url')
          .in('id', linkedIdList)
      : { data: [] as ParentWrestlerRow[] };

  const byId = new Map<string, ParentWrestlerRow>();
  for (const r of [...(primaryRows ?? []), ...(linkedRows ?? [])]) {
    byId.set(r.id, r as ParentWrestlerRow);
  }
  return Array.from(byId.values()).sort((a, b) =>
    `${a.first_name ?? ''} ${a.last_name ?? ''}`.localeCompare(`${b.first_name ?? ''} ${b.last_name ?? ''}`, undefined, {
      sensitivity: 'base',
    })
  );
}
