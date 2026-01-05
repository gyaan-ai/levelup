import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AvailabilityPage() {
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

  if (userData?.role !== 'athlete') {
    if (userData?.role === 'parent') {
      redirect('/browse');
    } else if (userData?.role === 'admin') {
      redirect('/admin');
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Set Your Availability</CardTitle>
          <CardDescription>
            Manage when you&apos;re available for sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Availability management coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}

