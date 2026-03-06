import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET - single group with channel, members, and kids */
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

    const { data: group, error: groupError } = await supabase
      .from('messaging_groups')
      .select('id, name, athlete_id, created_at')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const { data: channels } = await supabase
      .from('messaging_channels')
      .select('id, name, position')
      .eq('group_id', groupId)
      .order('position', { ascending: true });

    const channel = (channels ?? [])[0] ?? null;

    const { data: members } = await supabase
      .from('messaging_group_members')
      .select('user_id, role, joined_at')
      .eq('group_id', groupId);

    const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, photo_url')
      .in('id', userIds);

    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    const athleteMap = new Map((athletes ?? []).map((a) => [a.id, a]));

    const membersWithNames = (members ?? []).map((m) => {
      const u = userMap.get(m.user_id);
      const a = athleteMap.get(m.user_id);
      const name = a
        ? [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Coach'
        : (u?.email ?? m.user_id);
      return {
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        name,
        isCoach: !!a,
      };
    });

    const { data: kids } = await supabase
      .from('messaging_group_kids')
      .select('youth_wrestler_id, added_at')
      .eq('group_id', groupId);

    const ywIds = [...new Set((kids ?? []).map((k) => k.youth_wrestler_id))];
    const { data: youthWrestlers } = await supabase
      .from('youth_wrestlers')
      .select('id, first_name, last_name, parent_id')
      .in('id', ywIds);

    const ywMap = new Map((youthWrestlers ?? []).map((yw) => [yw.id, yw]));

    const kidsWithNames = (kids ?? []).map((k) => {
      const yw = ywMap.get(k.youth_wrestler_id);
      return {
        youthWrestlerId: k.youth_wrestler_id,
        addedAt: k.added_at,
        name: yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ') : '—',
        parentId: yw?.parent_id ?? null,
      };
    });

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        athleteId: group.athlete_id,
        createdAt: group.created_at,
      },
      channel: channel
        ? { id: channel.id, name: channel.name, position: channel.position }
        : null,
      members: membersWithNames,
      kids: kidsWithNames,
    });
  } catch (e) {
    console.error('Messaging group GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
