import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackLink } from '@/components/back-link';
import { CoachProfileAvailabilitySection } from '@/components/coach-profile-availability-section';
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

  if (userData?.role !== 'coach' && userData?.role !== 'admin') {
    if (userData?.role === 'parent') redirect('/browse');
    redirect('/login');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <BackLink fallbackHref="/athlete-dashboard" label="Back to Schedule" />
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your coaching calendar</CardTitle>
          <CardDescription>
            Set your <strong>weekly template</strong> once, tap <strong>Quick fill</strong> to roll it into the next two
            weeks, then fine-tune single days below. Parents only see times you add here.
          </CardDescription>
        </CardHeader>
      </Card>
      <CoachProfileAvailabilitySection embedInAvailabilityHub />
      <AvailabilityManager />
    </div>
  );
}





