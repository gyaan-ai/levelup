import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { BackLink } from '@/components/back-link';
import { SessionRequestsClient, type RawRequestItem } from '../session-requests-client';

export default async function SessionRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/sessions/' + sessionId + '/requests');

  const { data: session } = await supabase
    .from('sessions')
    .select('id, parent_id, athlete_id, session_mode, session_type, scheduled_datetime, athletes(id, first_name, last_name)')
    .eq('id', sessionId)
    .single();
  if (!session || (session as { parent_id?: string }).parent_id !== user.id) notFound();
  const mode = (session as { session_mode?: string }).session_mode;
  const type = (session as { session_type?: string }).session_type;
  const isPartnerOpen = mode === 'partner-open';
  const isSmallGroup = type === 'group' || type === 'small_group';
  if (!isPartnerOpen && !isSmallGroup) notFound();

  const { data: requests } = await supabase
    .from('session_join_requests')
    .select(`
      id,
      message,
      status,
      created_at,
      responded_at,
      youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level, school)
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  const athleteRaw = session.athletes;
  const athlete = (Array.isArray(athleteRaw) ? athleteRaw[0] : athleteRaw) as { id: string; first_name: string; last_name: string } | null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-4">
        <BackLink fallbackHref="/dashboard" label="Back to Dashboard" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Join Requests</h1>
      <p className="text-muted-foreground mb-6">
        {isPartnerOpen ? 'Partner' : 'Small group'} session with {athlete?.first_name} {athlete?.last_name}. Approve or decline based on skill level, weight, etc.
      </p>
      <SessionRequestsClient
        sessionId={sessionId}
        initialRequests={(requests ?? []) as RawRequestItem[]}
      />
    </div>
  );
}
