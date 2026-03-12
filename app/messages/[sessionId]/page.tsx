import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { formatEST } from '@/lib/format-date';
import { MessagesThread, type MessageRow } from './messages-thread';

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('id, parent_id, athlete_id, scheduled_datetime, athletes(id, first_name, last_name, school), facilities(name)')
    .eq('id', sessionId)
    .single();

  if (sessErr || !session) notFound();
  const isParent = session.parent_id === user.id;
  const isCoach = session.athlete_id === user.id;
  if (!isParent && !isCoach) notFound();

  const { data: messages } = await supabase
    .from('booking_messages')
    .select('id, session_id, sender_id, body, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  const coach = session.athletes;
  const coachObj = Array.isArray(coach) ? coach[0] : coach;
  const coachName = coachObj
    ? `${(coachObj as { first_name?: string }).first_name} ${(coachObj as { last_name?: string }).last_name}`
    : 'Coach';
  const dateStr = formatEST(new Date(session.scheduled_datetime), 'EEE, MMM d, yyyy h:mm a');

  const heading = isParent
    ? `Conversation with ${coachName} · ${dateStr}`
    : `Session messages · ${dateStr}`;
  const backHref = isParent ? '/bookings' : '/athlete-dashboard';
  const backLabel = isParent ? 'Back to bookings' : 'Back to dashboard';

  return (
    <MessagesThread
      sessionId={sessionId}
      initialMessages={(messages ?? []) as MessageRow[]}
      currentUserId={user.id}
      heading={heading}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
