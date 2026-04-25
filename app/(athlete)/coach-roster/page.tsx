import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { CoachRosterClient } from './coach-roster-client';
import { fetchCoachRosterData } from '@/lib/coach-roster';

export const dynamic = 'force-dynamic';

export default async function CoachRosterPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'coach' && userData?.role !== 'admin') redirect('/athlete-dashboard');

  const cookieStore = await cookies();
  const viewAsCoachId =
    userData?.role === 'admin' ? cookieStore.get('levelup_view_as_coach_id')?.value : null;
  const coachId = viewAsCoachId || user.id;

  const { data: athlete } = await supabase.from('athletes').select('id').eq('id', coachId).maybeSingle();
  if (!viewAsCoachId && !athlete) redirect('/onboarding');

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);

  const admin = createAdminClient(tenant.slug);
  const { entries, nextSession } = await fetchCoachRosterData(admin, coachId, baseUrl);

  return (
    <div className="container mx-auto px-4 py-5 pb-24 md:py-8 max-w-3xl">
      <Link href="/athlete-dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← Home
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Family roster</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Parents, emails, and phones for everyone who has ever been on your sessions — copy for weekly blasts or texts.
        </p>
      </div>
      <CoachRosterClient entries={entries} nextSession={nextSession} />
    </div>
  );
}
