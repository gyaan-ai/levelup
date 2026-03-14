import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionRegisterClient } from './register-client';
import { User, Calendar, MapPin, Users } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { SchoolLogo } from '@/components/school-logo';

export default async function SessionRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wrestler?: string }>;
}) {
  const { id: sessionId } = await params;
  const sp = await searchParams;
  const preselectedWrestlerId = sp.wrestler?.trim() || '';
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/sessions/${sessionId}/register`);

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  const role = userData?.role;
  if (role !== 'parent' && role !== 'admin' && role !== 'athlete' && role !== 'youth_wrestler') redirect('/dashboard');

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select(`
      id,
      parent_id,
      join_policy,
      athlete_id,
      session_mode,
      session_type,
      scheduled_datetime,
      current_participants,
      max_participants,
      price_per_participant,
      total_price,
      athletes(id, first_name, last_name, school, photo_url),
      facilities(id, name, address)
    `)
    .eq('id', sessionId)
    .in('status', ['scheduled', 'pending_payment'])
    .single();

  if (sessionErr || !session) notFound();

  const s = session as {
    parent_id?: string;
    join_policy?: string;
    session_type?: string;
    scheduled_datetime?: string;
    current_participants?: number;
    max_participants?: number;
    price_per_participant?: number;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string }[];
    facilities?: { id: string; name?: string; address?: string } | { id: string; name?: string; address?: string }[];
  };

  const isOwner = s.parent_id === user.id;
  if (!isOwner && s.join_policy !== 'public' && s.join_policy !== 'invite_only') notFound();

  const current = s.current_participants ?? 1;
  const max = s.max_participants ?? 2;
  if (current >= max) notFound();

  const pricePer = s.price_per_participant ?? 0;
  if (!isOwner && pricePer <= 0) notFound();

  const isSmallGroup =
    s.session_type === 'group' ||
    s.session_type === '2-athlete' ||
    s.session_type === 'small_group' ||
    (max >= 2 && s.session_type !== '1-on-1');
  // Small group = free for everyone (no Stripe), same as Liam's — show gold free button.
  const freeSmallGroupJoin = !isOwner && isSmallGroup;

  // Youth wrestlers this user can add (primary parent or linked parent)
  const { data: primaryIds } = await supabase
    .from('youth_wrestlers')
    .select('id')
    .eq('parent_id', user.id)
    .eq('active', true);
  const { data: linkedRows } = await supabase
    .from('youth_wrestler_parents')
    .select('youth_wrestler_id')
    .eq('parent_id', user.id);
  const linkedIds = [...new Set((linkedRows ?? []).map((r: { youth_wrestler_id: string }) => r.youth_wrestler_id))];
  const allIds = [...new Set([...(primaryIds ?? []).map((r: { id: string }) => r.id), ...linkedIds, user.id])];
  const { data: youthWrestlersRaw } = allIds.length > 0
    ? await supabase
        .from('youth_wrestlers')
        .select('id, first_name, last_name, age, weight_class, skill_level')
        .in('id', allIds)
        .eq('active', true)
        .order('created_at', { ascending: false })
    : { data: [] };
  const youthWrestlers = youthWrestlersRaw ?? [];

  const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
  const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
  const dt = s.scheduled_datetime ? new Date(s.scheduled_datetime) : null;

  const admin = createAdminClient(tenant.slug);
  const { data: participants } = await admin
    .from('session_participants')
    .select('youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level)')
    .eq('session_id', sessionId);
  const participantsList = (participants ?? []).map((p) => {
    const raw = (p as { youth_wrestlers?: { first_name?: string; last_name?: string; age?: number; weight_class?: string } | { first_name?: string; last_name?: string; age?: number; weight_class?: string }[] | null }).youth_wrestlers;
    const yw = Array.isArray(raw) ? raw[0] : raw;
    if (!yw) return null;
    const name = `${yw.first_name ?? ''} ${yw.last_name ?? ''}`.trim();
    if (!name) return null;
    const parts = [name];
    if (yw.age != null) parts.push(`${yw.age} yrs`);
    if (yw.weight_class) parts.push(`${yw.weight_class} lbs`);
    return parts.join(' · ');
  }).filter(Boolean) as string[];

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Link href="/find-training" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← Back to Dashboard
      </Link>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isOwner ? 'Add your wrestler to this session' : freeSmallGroupJoin ? 'Join this session (free — early adopter)' : 'Pay & register for session'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? 'Choose a wrestler to add. No extra charge — you’re the session owner.'
              : freeSmallGroupJoin
                ? 'Your early adopter benefit covers this small group join. Choose a wrestler and tap Add — no payment.'
                : 'Choose a wrestler and pay to secure the spot. You’ll complete payment on the next screen.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              {coach ? `${(coach as { first_name?: string; last_name?: string }).first_name ?? ''} ${(coach as { first_name?: string; last_name?: string }).last_name ?? ''}`.trim() : '—'}
              {coach?.school && (
                <>
                  <SchoolLogo school={(coach as { school?: string }).school ?? ''} size="sm" />
                  <span className="text-muted-foreground text-sm">({(coach as { school?: string }).school})</span>
                </>
              )}
            </p>
            {dt && (
              <p className="text-sm flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatEST(dt, 'EEEE, MMM d, yyyy')} at {formatEST(dt, 'h:mm a')}
              </p>
            )}
            {fac && (
              <p className="text-sm flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {(fac as { name?: string }).name}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {current} / {max} participants
              {!isOwner && pricePer > 0 && <> · <strong>${Number(pricePer).toFixed(2)}</strong> per spot</>}
            </p>
            {participantsList.length > 0 && (
              <div className="text-sm pt-1">
                <p className="font-medium text-foreground mb-1">Registered ({participantsList.length}):</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  {participantsList.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <SessionRegisterClient
            sessionId={sessionId}
            isOwner={!!isOwner}
            isSmallGroup={isSmallGroup}
            pricePerParticipant={pricePer}
            youthWrestlers={youthWrestlers as Array<{ id: string; first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string }>}
            initialWrestlerId={preselectedWrestlerId && youthWrestlers.some((yw) => yw.id === preselectedWrestlerId) ? preselectedWrestlerId : ''}
            freeSmallGroupJoin={freeSmallGroupJoin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
