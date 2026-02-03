import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { BrowseAthletesClient } from './browse-client';
import { Athlete } from '@/types';

export const metadata = {
  title: 'Browse Elite Coaches | The Guild',
  description:
    'Train with NCAA coaches in your community. View profiles, credentials, and reviews. Book private technique sessions.',
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

  if (userData?.role === 'athlete') {
    redirect('/athlete-dashboard');
  }
  // parent and admin can both access browse (admin can switch to product view)

  // Fetch active athletes (profile complete). Photo and certifications optional for now.
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('active', true)
    .order('average_rating', { ascending: false, nullsFirst: true })
    .order('school', { ascending: true });

  if (error) {
    console.error('Error fetching athletes:', error);
  }

  const athletesList = (athletes || []) as Athlete[];
  const athleteIds = athletesList.map((a) => a.id);

  // Fetch next available slot per coach (earliest slot_date >= today)
  const today = new Date().toISOString().slice(0, 10);
  const { data: slots } = athleteIds.length
    ? await supabase
        .from('athlete_availability_slots')
        .select('athlete_id, slot_date, start_time')
        .in('athlete_id', athleteIds)
        .gte('slot_date', today)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true })
    : { data: [] };

  const nextByAthlete = new Map<string, { slot_date: string; start_time: string }>();
  for (const row of slots || []) {
    const r = row as { athlete_id: string; slot_date: string; start_time: string };
    if (!nextByAthlete.has(r.athlete_id)) {
      nextByAthlete.set(r.athlete_id, { slot_date: r.slot_date, start_time: r.start_time });
    }
  }

  const athletesWithNext = athletesList.map((a) => ({
    ...a,
    nextAvailable: nextByAthlete.get(a.id) ?? null,
  }));

  return <BrowseAthletesClient initialAthletes={athletesWithNext} />;
}
