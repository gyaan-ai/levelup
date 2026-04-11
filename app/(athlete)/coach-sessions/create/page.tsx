import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { BackLink } from '@/components/back-link';
import { CoachCreateSessionForm } from './coach-create-session-form';
import { getRecommendedPricesForCoach } from '@/lib/coach-session-pricing';

export const dynamic = 'force-dynamic';

export default async function CoachCreateSessionPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'coach' && userData?.role !== 'admin') redirect('/athlete-dashboard');

  const { data: athlete } = await supabase.from('athletes').select('*').eq('id', user.id).maybeSingle();
  if (!athlete) redirect('/onboarding');

  // Get coach's facilities (primary + secondary)
  const admin = createAdminClient(tenant.slug);
  const facilityIds = [athlete.facility_id, athlete.secondary_facility_id].filter(Boolean) as string[];
  
  let facilities: Array<{ id: string; name: string; school: string; address?: string | null }> = [];
  if (facilityIds.length > 0) {
    const { data: coachFacilities } = await admin
      .from('facilities')
      .select('id, name, school, address')
      .in('id', facilityIds);
    facilities = coachFacilities ?? [];
  }

  // If coach has no facilities, get all facilities as fallback
  if (facilities.length === 0) {
    const { data: allFacilities } = await admin
      .from('facilities')
      .select('id, name, school, address')
      .order('name');
    facilities = allFacilities ?? [];
  }

  const coachId = user.id;
  const coachName = [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Coach';

  const recommendedPrices = await getRecommendedPricesForCoach(admin, coachId);

  return (
    <div className="container mx-auto px-4 py-5 pb-24 md:py-8 max-w-xl">
      <div className="mb-4">
        <BackLink fallbackHref="/coach-sessions" label="Back to Sessions" />
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Create Session</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up a session, get a share link, send it to families.
        </p>
      </div>
      <CoachCreateSessionForm
        coachId={coachId}
        coachName={coachName}
        facilities={facilities}
        recommendedPrices={recommendedPrices}
      />
    </div>
  );
}
