import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { BookingFlow } from './booking-flow';

export default async function BookPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    notFound();
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);
  const loginRedirect = '/login?redirect=' + encodeURIComponent('/book/' + athleteId);

  // Check authentication (handle invalid/expired refresh token gracefully)
  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      redirect(loginRedirect);
    }
    user = data?.user ?? null;
  } catch {
    redirect(loginRedirect);
  }

  if (!user) {
    redirect(loginRedirect);
  }

  // Check user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'parent') {
    if (userData?.role === 'athlete') {
      redirect('/athlete-dashboard');
    } else if (userData?.role === 'admin') {
      redirect('/admin');
    } else {
      redirect('/browse');
    }
  }

  // Fetch athlete data
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, school, photo_url, facility_id')
    .eq('id', athleteId)
    .eq('active', true)
    .single();

  if (athleteError || !athlete) {
    notFound();
  }

  // Fetch parent's youth wrestlers
  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .eq('parent_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (!youthWrestlers || youthWrestlers.length === 0) {
    redirect('/wrestlers/add?redirect=' + encodeURIComponent('/book/' + athleteId));
  }

  // Get facility info if available
  let facility = null;
  if (athlete.facility_id) {
    const { data: facilityData } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', athlete.facility_id)
      .single();
    facility = facilityData;
  }

  return (
    <BookingFlow
      athlete={athlete}
      facility={facility}
      youthWrestlers={youthWrestlers || []}
      tenantPricing={tenant.pricing}
    />
  );
}





