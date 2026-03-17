import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { SessionReviewForm } from './session-review-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function SessionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) notFound();

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirect=' + encodeURIComponent(`/sessions/${sessionId}/review`));

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/dashboard');

  const admin = createAdminClient(tenant.slug);
  const { data: session, error } = await admin
    .from('sessions')
    .select('id, parent_id, athlete_id, scheduled_datetime, status, athletes(id, first_name, last_name), facilities(name)')
    .eq('id', sessionId)
    .single();

  if (error || !session) notFound();
  const sessionDate = session.scheduled_datetime ? new Date(session.scheduled_datetime) : null;
  const isPast = sessionDate ? sessionDate < new Date() : false;
  if (session.status !== 'completed' && !isPast) notFound();

  const isOwner = session.parent_id === user.id;
  let isParticipant = false;
  if (!isOwner) {
    const { data: part } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('parent_id', user.id)
      .maybeSingle();
    isParticipant = !!part;
  }
  if (!isOwner && !isParticipant) notFound();

  const a = session.athletes;
  const coach = Array.isArray(a) ? a[0] : (a as { id: string; first_name: string; last_name: string } | null);
  const f = session.facilities;
  const facility = Array.isArray(f) ? f[0] : (f as { name: string } | null);

  const { data: existing } = await supabase
    .from('reviews')
    .select('id, rating, comment, tags')
    .eq('session_id', sessionId)
    .eq('parent_id', user.id)
    .maybeSingle();

  const coachName = coach ? `${coach.first_name} ${coach.last_name}` : 'Coach';
  const facilityName = facility?.name ?? '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Link
        href="/bookings"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to My bookings
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Leave feedback</h1>
        <p className="text-muted-foreground mt-1">
          How was your session with {coachName} at {facilityName}?
        </p>
      </div>
      <SessionReviewForm
        sessionId={sessionId}
        coachId={coach?.id ?? ''}
        coachName={coachName}
        existingReview={existing ? { rating: existing.rating, comment: existing.comment ?? '', tags: (existing.tags as string[]) ?? [] } : null}
      />
    </div>
  );
}
