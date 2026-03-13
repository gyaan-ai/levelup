import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Athlete } from '@/types';
import { TrainingClient } from './training-client';

export const metadata = {
  title: 'Training | The Guild',
  description: 'Book private sessions, find partner or small group training, or browse coaches.',
};

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'private';

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'athlete') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin' && userData?.role !== 'youth_wrestler') redirect('/dashboard');

  const { data: athletes } = await supabase
    .from('athletes')
    .select('*')
    .eq('active', true)
    .order('average_rating', { ascending: false, nullsFirst: true })
    .order('school', { ascending: true });

  const athletesList = (athletes || []) as Athlete[];
  const athleteIds = athletesList.map((a) => a.id);

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
  for (const row of slots ?? []) {
    const r = row as { athlete_id: string; slot_date: string; start_time: string };
    if (!nextByAthlete.has(r.athlete_id)) nextByAthlete.set(r.athlete_id, { slot_date: r.slot_date, start_time: r.start_time });
  }

  const athletesWithNext = athletesList.map((a) => ({
    ...a,
    nextAvailable: nextByAthlete.get(a.id) ?? null,
  }));

  const isAdmin = userData?.role === 'admin';

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl mb-1">Training</h1>
      <p className="text-muted-foreground text-sm md:text-base mb-6">
        Book private, find partner or group sessions, or browse coaches
      </p>
      <TrainingClient
        initialTab={tab}
        athletesWithNext={athletesWithNext}
        isAdmin={!!isAdmin}
      />
    </div>
  );
}
