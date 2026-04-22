import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { isRewardsProgramEnabled } from '@/lib/rewards';
import { AdminRewardsClient } from './admin-rewards-client';

export const dynamic = 'force-dynamic';

export default async function AdminRewardsPage() {
  if (!isRewardsProgramEnabled()) {
    redirect('/admin');
  }

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/rewards');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') redirect('/dashboard');

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AdminRewardsClient />
    </div>
  );
}
