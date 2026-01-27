import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
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
    .select('id, parent_id, session_mode, scheduled_datetime, athletes(id, first_name, last_name)')
    .eq('id', sessionId)
    .single();
  if (!session || (session as { parent_id?: string }).parent_id !== user.id) notFound();
  if ((session as { session_mode?: string }).session_mode !== 'partner-open') notFound();

  const { data: requests } = await supabase
    .from('session_join_requests')
    .select(`
      id,
      message,
      status,
      created_at,
      youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level, school)
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  const athleteRaw = session.athletes;
  const athlete = (Array.isArray(athleteRaw) ? athleteRaw[0] : athleteRaw) as { id: string; first_name: string; last_name: string } | null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-2">Join Requests</h1>
      <p className="text-muted-foreground mb-6">
        Partner session with {athlete?.first_name} {athlete?.last_name}. Approve or decline requests below.
      </p>
      <SessionRequestsClient
        sessionId={sessionId}
        initialRequests={(requests ?? []) as RawRequestItem[]}
      />
    </div>
  );
}
