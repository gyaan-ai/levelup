import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AvailabilityManager } from './availability-manager';

export default async function AvailabilityPage() {
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

  if (userData?.role !== 'athlete') {
    if (userData?.role === 'parent') redirect('/browse');
    if (userData?.role === 'admin') redirect('/admin');
    redirect('/login');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Set Your Availability</CardTitle>
          <CardDescription>
            Manage when you&apos;re available for sessions. Parents will only see these slots when booking.
          </CardDescription>
        </CardHeader>
      </Card>
      <AvailabilityManager />
    </div>
  );
}





