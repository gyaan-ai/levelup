import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export default async function WorkspaceFromSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient(tenant.slug);
  const { data: session } = await admin
    .from('sessions')
    .select('id, parent_id, athlete_id')
    .eq('id', sessionId)
    .single();

  if (!session) notFound();
  const isParent = session.parent_id === user.id;
  const isCoach = session.athlete_id === user.id;
  const { data: ud } = await supabase.from('users').select('role').eq('id', user.id).single();
  const isAdmin = ud?.role === 'admin';
  if (!isParent && !isCoach && !isAdmin) notFound();

  const { data: participants } = await admin
    .from('session_participants')
    .select('youth_wrestler_id')
    .eq('session_id', sessionId);

  const youthWrestlerId = participants?.[0]?.youth_wrestler_id;
  if (!youthWrestlerId) notFound();

  const { data: workspaceId } = await admin.rpc('get_or_create_workspace', {
    p_parent_id: session.parent_id,
    p_youth_wrestler_id: youthWrestlerId,
    p_athlete_id: session.athlete_id,
  });

  redirect(`/workspaces/${workspaceId}`);
}
