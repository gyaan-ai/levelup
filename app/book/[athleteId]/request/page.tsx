import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { RequestSessionClient } from './request-session-client';

export default async function RequestSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ youthWrestlerId?: string; sessionType?: string }>;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const preselectedYouthWrestlerId = sp.youthWrestlerId ?? null;
  const initialSessionType =
    sp.sessionType === 'partner' ? 'partner' : sp.sessionType === 'private' ? 'private' : undefined;

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) notFound();

  const supabase = await createClient(tenant.slug);
  const loginRedirect = '/login?redirect=' + encodeURIComponent(`/book/${athleteId}/request`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginRedirect);

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'coach') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/browse');

  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, school, photo_url, photo_focus_x, photo_focus_y')
    .eq('id', athleteId)
    .eq('active', true)
    .single();

  if (athleteError || !athlete) notFound();

  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .eq('parent_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  const { data: facilities } = await supabase.from('facilities').select('id, name, school').order('name');

  return (
    <RequestSessionClient
      athlete={athlete}
      facilities={(facilities ?? []) as { id: string; name: string; school?: string }[]}
      youthWrestlers={youthWrestlers ?? []}
      preselectedYouthWrestlerId={preselectedYouthWrestlerId}
      initialSessionType={initialSessionType}
    />
  );
}
