import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { InboxClient } from './inbox-client';

export default async function InboxPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userData?.role;
  if (role !== 'parent' && role !== 'athlete') {
    redirect(role === 'admin' ? '/admin' : '/dashboard');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Messages</h1>
      <p className="text-muted-foreground mb-6">
        {role === 'parent' ? 'Message coaches before or after booking.' : 'Conversations with parents.'}
      </p>
      <InboxClient role={role} />
    </div>
  );
}
