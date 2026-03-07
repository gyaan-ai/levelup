import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
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
  if (role !== 'parent' && role !== 'athlete' && role !== 'admin') {
    redirect('/dashboard');
  }

  const isParentView = role === 'parent' || role === 'admin';

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold">Community</h1>
        <p className="text-sm text-muted-foreground">
          {isParentView ? 'Message coaches or join group conversations.' : 'Groups and direct conversations with parents.'}
        </p>
      </div>
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div className="text-center text-muted-foreground max-w-sm">
          <p className="font-medium text-foreground mb-1">Select a conversation</p>
          <p className="text-sm">
            Choose a group or direct message from the sidebar to start.
          </p>
        </div>
      </div>
    </div>
  );
}
