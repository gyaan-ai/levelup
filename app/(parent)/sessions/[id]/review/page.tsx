import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { SessionReviewForm } from './session-review-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ReviewError({ title, message }: { title: string; message: string }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/bookings" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to My bookings
          </Link>
        </Button>
      </div>
    </div>
  );
}

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

  if (error || !session) {
    return (
      <ReviewError
        title="Session not found"
        message="We couldn't find that session. Go back to My bookings and try \"Leave feedback\" again from the session card."
      />
    );
  }
  if (session.status !== 'completed') {
    return (
      <ReviewError
        title="Feedback not available yet"
        message="This session isn't marked complete yet. Coaches mark sessions complete after they happen. Check back soon or contact the coach if the session already took place."
      />
    );
  }

  const isOwner = session.parent_id === user.id;
  // Participant = session owner OR parent of a youth wrestler in this session (same rule as My bookings). Use admin only so RLS and multi-row don't block.
  let isParticipant = false;
  if (!isOwner) {
    const { data: participants } = await admin
      .from('session_participants')
      .select('youth_wrestler_id, parent_id')
      .eq('session_id', sessionId);
    const rows = participants ?? [];
    // They're a participant if they're on any row as parent_id (they signed up their kid) or if their kid is in the session
    const hasRowAsParent = rows.some((r: { parent_id?: string | null }) => r.parent_id === user.id);
    if (hasRowAsParent) {
      isParticipant = true;
    } else {
      const youthIds = rows.map((r: { youth_wrestler_id: string | null }) => r.youth_wrestler_id).filter(Boolean) as string[];
      if (youthIds.length > 0) {
        const { data: youthRows } = await admin
          .from('youth_wrestlers')
          .select('id')
          .in('id', youthIds)
          .eq('parent_id', user.id)
          .limit(1);
        if (youthRows && youthRows.length > 0) isParticipant = true;
        if (!isParticipant) {
          const { data: linked } = await admin
            .from('youth_wrestler_parents')
            .select('youth_wrestler_id')
            .in('youth_wrestler_id', youthIds)
            .eq('parent_id', user.id)
            .limit(1);
          if (linked && linked.length > 0) isParticipant = true;
        }
      }
    }
  }
  if (!isOwner && !isParticipant) {
    return (
      <ReviewError
        title="Can't leave feedback for this session"
        message="You don't have access to leave feedback for this session. If you attended with your wrestler, make sure you're signed in with the account that booked the session, then try again from My bookings."
      />
    );
  }

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
