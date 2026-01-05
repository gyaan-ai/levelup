import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export default async function BrowsePage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    redirect('/404');
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'parent') {
    // Redirect based on role
    if (userData?.role === 'athlete') {
      redirect('/dashboard');
    } else if (userData?.role === 'admin') {
      redirect('/admin');
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Browse Athletes</h1>
      <p className="text-muted-foreground">Browse page coming soon...</p>
    </div>
  );
}
