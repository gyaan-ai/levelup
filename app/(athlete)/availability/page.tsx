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
            Add your open hours on the calendar below (Eastern). That&apos;s the only place parents see when they can
            request you. Optionally block whole days off at the bottom.
          </CardDescription>
        </CardHeader>
      </Card>
      <AvailabilityManager />
      <CoachProfileAvailabilitySection />
    </div>
  );
}





