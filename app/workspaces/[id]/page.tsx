import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { WorkspaceClient } from './workspace-client';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient(tenant.slug);
  const { data: workspace } = await admin.from('workspaces').select('parent_id, athlete_id').eq('id', id).single();
  if (!workspace) notFound();

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  const hasAccess = workspace.parent_id === user.id || workspace.athlete_id === user.id || userData?.role === 'admin';
  if (!hasAccess) redirect('/workspaces');

  const isCoach = workspace.athlete_id === user.id;
  return <WorkspaceClient workspaceId={id} isCoach={isCoach} />;
}
