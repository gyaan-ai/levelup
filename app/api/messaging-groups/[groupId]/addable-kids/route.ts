import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET - youth wrestlers the coach can add to this group (have had sessions with, not already in group) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: group } = await supabase
      .from('messaging_groups')
      .select('athlete_id')
      .eq('id', groupId)
      .single();
    if (!group || group.athlete_id !== user.id) {
      return NextResponse.json({ error: 'Only the group coach can list addable kids' }, { status: 403 });
    }

    const { data: alreadyInGroup } = await supabase
      .from('messaging_group_kids')
      .select('youth_wrestler_id')
      .eq('group_id', groupId);
    const inGroupIds = new Set((alreadyInGroup ?? []).map((r) => r.youth_wrestler_id));

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('athlete_id', user.id);
    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length === 0) {
      return NextResponse.json({ kids: [] });
    }

    const { data: participants } = await supabase
      .from('session_participants')
      .select('youth_wrestler_id')
      .in('session_id', sessionIds);
    const ywIds = [...new Set((participants ?? []).map((p) => p.youth_wrestler_id).filter(Boolean))] as string[];
    const addableIds = ywIds.filter((id) => !inGroupIds.has(id));
    if (addableIds.length === 0) {
      return NextResponse.json({ kids: [] });
    }

    const { data: youthWrestlers } = await supabase
      .from('youth_wrestlers')
      .select('id, first_name, last_name, parent_id')
      .in('id', addableIds);

    const kids = (youthWrestlers ?? []).map((yw) => ({
      id: yw.id,
      first_name: yw.first_name,
      last_name: yw.last_name,
      name: [yw.first_name, yw.last_name].filter(Boolean).join(' ') || '—',
      parent_id: yw.parent_id,
    }));

    return NextResponse.json({ kids });
  } catch (e) {
    console.error('Addable kids GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
