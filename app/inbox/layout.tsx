import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { InboxSidebar } from './inbox-sidebar';

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  if (role !== 'parent' && role !== 'athlete' && role !== 'youth_wrestler') {
    redirect(role === 'admin' ? '/admin' : '/dashboard');
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
      <InboxSidebar role={role as 'parent' | 'athlete' | 'youth_wrestler'} />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
