import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { formatEST } from '@/lib/format-date';
import { EditSessionForm } from './edit-session-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default async function AdminEditSessionPage({
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
  if (!user) redirect('/login');
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') redirect('/admin');

  const admin = createAdminClient(tenant.slug);
  const { data: session, error } = await admin
    .from('sessions')
    .select(`
      id,
      scheduled_datetime,
      status,
      session_type,
      session_mode,
      focus_area,
      focus_area_2,
      join_policy,
      current_participants,
      max_participants,
      price_per_participant,
      athlete_payment,
      athlete_payout_date,
      athletes(id, first_name, last_name, school),
      facilities(id, name),
      session_participants(amount_paid)
    `)
    .eq('id', sessionId)
    .single();

  if (error || !session) notFound();

  const coach = Array.isArray((session as { athletes?: unknown }).athletes)
    ? (session as { athletes: unknown[] }).athletes[0]
    : (session as { athletes?: { first_name?: string; last_name?: string; school?: string } }).athletes;
  const fac = Array.isArray((session as { facilities?: unknown }).facilities)
    ? (session as { facilities: unknown[] }).facilities[0]
    : (session as { facilities?: { name?: string } }).facilities;

  const partRows = (session as { session_participants?: { amount_paid?: number | null }[] }).session_participants;
  const participantAmountPaidSum = Array.isArray(partRows)
    ? partRows.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0)
    : 0;

  // Map DB session_type to UI values
  const dbSessionType = (session as { session_type?: string }).session_type;
  const uiSessionType = dbSessionType === 'group' ? 'small_group' 
    : dbSessionType === '2-athlete' ? 'partner'
    : dbSessionType === '1-on-1' ? 'private'
    : dbSessionType || 'small_group';

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-1">Edit session</h1>
      <p className="text-muted-foreground text-sm mb-6">
        {coach ? `${(coach as { first_name?: string }).first_name ?? ''} ${(coach as { last_name?: string }).last_name ?? ''}`.trim() : '—'}
        {(fac as { name?: string })?.name && ` · ${(fac as { name?: string }).name}`}
      </p>
      <EditSessionForm
        sessionId={sessionId}
        sessionStatus={(session as { status?: string }).status}
        sessionType={uiSessionType}
        focusArea={(session as { focus_area?: string | null }).focus_area ?? ''}
        focusArea2={(session as { focus_area_2?: string | null }).focus_area_2 ?? ''}
        joinPolicy={((session as { join_policy?: string }).join_policy as 'public' | 'private' | 'invite_only') ?? 'private'}
        maxParticipants={(session as { max_participants?: number }).max_participants ?? 6}
        pricePerParticipant={(session as { price_per_participant?: number }).price_per_participant ?? 0}
        currentParticipants={(session as { current_participants?: number }).current_participants ?? 0}
        athletePayment={
          (session as { athlete_payment?: number | null }).athlete_payment != null
            ? Number((session as { athlete_payment?: number | null }).athlete_payment)
            : null
        }
        athletePayoutDate={(session as { athlete_payout_date?: string | null }).athlete_payout_date ?? null}
        participantAmountPaidSum={participantAmountPaidSum}
        scheduledDate={formatEST((session as { scheduled_datetime?: string }).scheduled_datetime ?? '', 'yyyy-MM-dd')}
        scheduledTime={formatEST((session as { scheduled_datetime?: string }).scheduled_datetime ?? '', 'HH:mm')}
      />
    </div>
  );
}
