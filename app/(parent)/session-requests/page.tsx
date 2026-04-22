import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { SessionRequestsClient } from './session-requests-client';

export const metadata = {
  title: 'Session requests | The Guild',
  description: 'Status of requests you sent to coaches.',
};

export const dynamic = 'force-dynamic';

export default async function ParentSessionRequestsPage() {
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
  if (userData?.role === 'coach') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/dashboard');

  const { data: rows } = await supabase
    .from('parent_session_requests')
    .select(
      `
      id,
      coach_id,
      facility_id,
      preferred_datetime,
      session_type,
      duration_minutes,
      counter_preferred_datetime,
      counter_note,
      payment_deadline_at,
      message,
      flexibility_note,
      status,
      coach_response,
      created_session_id,
      responded_at,
      created_at,
      youth_wrestlers:youth_wrestler_id(first_name, last_name),
      athletes:coach_id(first_name, last_name, school),
      facilities:facility_id(name)
    `
    )
    .eq('requesting_parent_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl pb-24">
      <div className="mb-6">
        <Link href="/training" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
          ← Training
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Session requests</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Older requests you sent before booking moved to coach availability only. New requests can&apos;t be created
          here.
        </p>
      </div>

      <SessionRequestsClient initialRows={(rows ?? []) as SessionRequestRow[]} />
    </div>
  );
}

export type SessionRequestRow = {
  id: string;
  coach_id: string;
  facility_id: string | null;
  preferred_datetime: string | null;
  session_type: string | null;
  duration_minutes?: number | null;
  counter_preferred_datetime?: string | null;
  counter_note?: string | null;
  payment_deadline_at?: string | null;
  message: string | null;
  flexibility_note: string | null;
  status: string;
  coach_response: string | null;
  created_session_id: string | null;
  responded_at: string | null;
  created_at: string;
  youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
  athletes?: { first_name?: string; last_name?: string; school?: string } | { first_name?: string; last_name?: string; school?: string }[] | null;
  facilities?: { name?: string } | { name?: string }[] | null;
};
