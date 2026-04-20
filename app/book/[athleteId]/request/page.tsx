import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { RequestSessionClient } from './request-session-client';

function normalizeBookTimeParam(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

async function coachHasPublishedAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string
): Promise<boolean> {
  const { data: recur } = await supabase.from('athlete_availability').select('id').eq('athlete_id', athleteId).limit(1);
  if (recur && recur.length > 0) return true;
  try {
    const { data: slots } = await supabase
      .from('athlete_availability_slots')
      .select('id')
      .eq('athlete_id', athleteId)
      .limit(1);
    if (slots && slots.length > 0) return true;
  } catch {
    /* table may not exist */
  }
  return false;
}

export default async function RequestSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ youthWrestlerId?: string; sessionType?: string; date?: string; time?: string }>;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const preselectedYouthWrestlerId = sp.youthWrestlerId ?? null;
  const initialSessionType =
    sp.sessionType === 'partner' ? 'partner' : sp.sessionType === 'private' ? 'private' : undefined;

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) notFound();

  const supabase = await createClient(tenant.slug);
  const loginRedirect = '/login?redirect=' + encodeURIComponent(`/book/${athleteId}/request`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginRedirect);

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'coach') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/browse');

  const dateQ = sp.date?.trim();
  const timeNorm = sp.time?.trim() ? normalizeBookTimeParam(sp.time) : null;
  if (dateQ && /^\d{4}-\d{2}-\d{2}$/.test(dateQ) && timeNorm) {
    const qs = new URLSearchParams();
    qs.set('date', dateQ);
    qs.set('time', timeNorm);
    if (preselectedYouthWrestlerId) qs.set('youthWrestlerId', preselectedYouthWrestlerId);
    redirect(`/book/${athleteId}?${qs.toString()}`);
  }

  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, school, photo_url, photo_focus_x, photo_focus_y')
    .eq('id', athleteId)
    .eq('active', true)
    .single();

  if (athleteError || !athlete) notFound();

  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .eq('parent_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  const { data: facilities } = await supabase.from('facilities').select('id, name, school').order('name');

  const coachHasCalendar = await coachHasPublishedAvailability(supabase, athleteId);

  return (
    <RequestSessionClient
      athlete={athlete}
      facilities={(facilities ?? []) as { id: string; name: string; school?: string }[]}
      youthWrestlers={youthWrestlers ?? []}
      preselectedYouthWrestlerId={preselectedYouthWrestlerId}
      initialSessionType={initialSessionType}
      coachHasPublishedAvailability={coachHasCalendar}
    />
  );
}
