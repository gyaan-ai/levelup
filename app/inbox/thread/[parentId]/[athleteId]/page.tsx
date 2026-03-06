import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { InquiryThread } from './inquiry-thread';

export default async function InboxThreadPage({
  params,
}: {
  params: Promise<{ parentId: string; athleteId: string }>;
}) {
  const { parentId, athleteId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (user.id !== parentId && user.id !== athleteId) notFound();

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = userData?.role;
  if (role !== 'parent' && role !== 'athlete') redirect('/inbox');

  return (
    <InquiryThread parentId={parentId} athleteId={athleteId} currentUserId={user.id} />
  );
}
