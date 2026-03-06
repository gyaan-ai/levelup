import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { GroupChannelClient } from './group-channel-client';

export default async function GroupChannelPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: group, error: groupError } = await supabase
    .from('messaging_groups')
    .select('id, name, athlete_id')
    .eq('id', groupId)
    .single();

  if (groupError || !group) notFound();

  const { data: membersRows } = await supabase
    .from('messaging_group_members')
    .select('user_id, role')
    .eq('group_id', groupId);

  const userIds = [...new Set((membersRows ?? []).map((m) => m.user_id))];
  const { data: athletes } = await supabase.from('athletes').select('id, first_name, last_name').in('id', userIds);
  const { data: users } = await supabase.from('users').select('id, email').in('id', userIds);
  const athleteMap = new Map((athletes ?? []).map((a) => [a.id, a]));
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const members = (membersRows ?? []).map((m) => {
    const a = athleteMap.get(m.user_id);
    const u = userMap.get(m.user_id);
    const name = a ? [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Coach' : (u?.email ?? 'User');
    return {
      userId: m.user_id,
      role: m.role,
      name,
      isCoach: !!a,
    };
  });

  const { data: kidsRows } = await supabase
    .from('messaging_group_kids')
    .select('youth_wrestler_id, added_at')
    .eq('group_id', groupId);

  const ywIds = (kidsRows ?? []).map((k) => k.youth_wrestler_id);
  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name, parent_id')
    .in('id', ywIds);
  const ywMap = new Map((youthWrestlers ?? []).map((yw) => [yw.id, yw]));

  const kids = (kidsRows ?? []).map((k) => {
    const yw = ywMap.get(k.youth_wrestler_id);
    return {
      youthWrestlerId: k.youth_wrestler_id,
      name: yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ') : '—',
      parentId: yw?.parent_id ?? null,
    };
  });

  const isCoach = group.athlete_id === user.id;

  return (
    <GroupChannelClient
      groupId={groupId}
      groupName={group.name}
      initialMembers={members}
      initialKids={kids}
      currentUserId={user.id}
      isCoach={isCoach}
    />
  );
}
