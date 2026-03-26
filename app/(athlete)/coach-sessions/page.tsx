import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

import { CoachSessionsClient } from './coach-sessions-client';
import type { CoachSession } from '@/app/(athlete)/athlete-dashboard/coach-schedule-card';

export const dynamic = 'force-dynamic';

export default async function CoachSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === 'requests' ? 'requests' : sp.tab === 'completed' ? 'completed' : 'upcoming';

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

  const now = new Date().toISOString();

  const { data: upcoming } = await supabase
    .from('sessions')
    .select('*, facilities(name), session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))')
    .eq('athlete_id', user.id)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', now)
    .order('scheduled_datetime', { ascending: true });

  const { data: completed } = await supabase
    .from('sessions')
    .select('*, facilities(name), session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))')
    .eq('athlete_id', user.id)
    .or('status.eq.completed,status.eq.cancelled,status.eq.no-show,scheduled_datetime.lt.' + now)
    .order('scheduled_datetime', { ascending: false })
    .limit(30);

  // Pending join requests for coach's sessions (RLS returns only coach's sessions)
  const { data: joinRequests } = await supabase
    .from('session_join_requests')
    .select(`
      id,
      session_id,
      message,
      status,
      created_at,
      youth_wrestler_id,
      youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const sessionIds = [...new Set((joinRequests ?? []).map((r: { session_id: string }) => r.session_id))];
  const { data: requestSessions } = sessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, scheduled_datetime, session_type, session_mode, facilities(name)')
        .in('id', sessionIds)
    : { data: [] };

  const sessionMap = new Map((requestSessions ?? []).map((s: { id: string }) => [s.id, s]));
  const requestsWithSession = (joinRequests ?? []).map((r: { session_id: string; [k: string]: unknown }) => ({
    ...r,
    session: sessionMap.get(r.session_id),
  }));

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl mb-1">My sessions</h1>
      <p className="text-muted-foreground text-sm md:text-base mb-6">
        Open sessions, who signed up, your payout · Requests · Past
      </p>
      <CoachSessionsClient
        initialTab={tab}
        upcomingSessions={(upcoming ?? []) as CoachSession[]}
        completedSessions={(completed ?? []) as CoachSession[]}
        pendingRequests={requestsWithSession as Array<{
          id: string;
          session_id: string;
          message?: string;
          status: string;
          created_at: string;
          youth_wrestler_id: string;
          youth_wrestlers?: { id: string; first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string } | null;
          session?: { id: string; scheduled_datetime: string; session_type?: string; session_mode?: string; facilities?: { name?: string } | null };
        }>}
        payoutRate={athlete?.payout_rate ?? 0.8333}
      />
    </div>
  );
}
