import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { BrowseAthletesClient } from './browse-client';
import { Athlete } from '@/types';

export const metadata = {
  title: 'Browse Elite Wrestlers | The Guild',
  description:
    'Train with NCAA wrestlers in your community. View profiles, credentials, and reviews. Book private technique sessions.',
};

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
      redirect('/athlete-dashboard');
    } else if (userData?.role === 'admin') {
      redirect('/admin');
    }
  }

  // Fetch active, verified athletes with photos
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('active', true)
    .eq('certifications_verified', true)
    .not('photo_url', 'is', null)
    .order('average_rating', { ascending: false, nullsFirst: false })
    .order('school', { ascending: true });

  if (error) {
    console.error('Error fetching athletes:', error);
  }

  const athletesList = (athletes || []) as Athlete[];

  return <BrowseAthletesClient initialAthletes={athletesList} />;
}
