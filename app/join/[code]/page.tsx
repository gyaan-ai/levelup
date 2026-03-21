import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Calendar, MapPin } from 'lucide-react';
import { ProfileImage } from '@/components/profile-image';
import { formatEST } from '@/lib/format-date';
import { JoinSessionClient } from './join-session-client';
import { hasMinPhoneDigits } from '@/lib/phone';
import { getEffectiveFilledCount } from '@/lib/sessions';

/** Always fresh roster from DB (avoid stale cached HTML after admin adds a participant). */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) notFound();

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch session by invite code with admin client so unauthenticated users can open the join link (RLS would otherwise block)
  const admin = createAdminClient(tenant.slug);
  const { data: session, error } = await admin
    .from('sessions')
    .select('*, athletes(id, first_name, last_name, school, photo_url), facilities(id, name, address)')
    .eq('partner_invite_code', code.toUpperCase())
    .single();

  if (error || !session) notFound();

  const maxParticipants = (session as { max_participants?: number }).max_participants ?? 2;

  const { data: participants } = await admin
    .from('session_participants')
    .select('*, youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level)')
    .eq('session_id', session.id);

  const currentParticipants = getEffectiveFilledCount({
    current_participants: (session as { current_participants?: number }).current_participants,
    max_participants: maxParticipants,
    session_participants: participants ?? [],
  });
  const isFull = currentParticipants >= maxParticipants;

  type YouthInfo = { first_name?: string; last_name?: string; age?: number; weight_class?: string };
  const participantsList = (participants ?? []).map((p) => {
    const raw = p.youth_wrestlers;
    const yw = (Array.isArray(raw) ? raw[0] : raw) as YouthInfo | null;
    const pAny = p as { roster_first_name?: string | null; roster_last_name?: string | null };
    const fromRoster = [pAny.roster_first_name, pAny.roster_last_name].filter(Boolean).join(' ').trim();
    const fromYw = yw ? `${yw.first_name ?? ''} ${yw.last_name ?? ''}`.trim() : '';
    const name = (fromYw || fromRoster).trim();
    if (!name) return null;
    const parts = [name];
    if (yw?.age != null) parts.push(`${yw.age} yrs`);
    if (yw?.weight_class) parts.push(`${yw.weight_class} lbs`);
    return parts.join(' · ');
  }).filter(Boolean) as string[];

  const athlete = session.athletes as { id: string; first_name: string; last_name: string; school: string; photo_url?: string } | null;
  const facility = session.facilities as { id: string; name: string; address?: string } | null;
  const scheduledAt = session.scheduled_datetime ? new Date(session.scheduled_datetime) : null;
  const dateTime = scheduledAt ? `${formatEST(scheduledAt, 'EEEE, MMMM d, yyyy')} at ${formatEST(scheduledAt, 'h:mm a')}` : '';

  const rawPrice = (session as { price_per_participant?: number }).price_per_participant;
  const pricePerParticipant = rawPrice != null && rawPrice > 0 ? rawPrice : 30;
  const sessionType = (session as { session_type?: string }).session_type;
  const isSmallGroup =
    sessionType === 'group' ||
    sessionType === '2-athlete' ||
    sessionType === 'small_group' ||
    (maxParticipants >= 2 && sessionType !== '1-on-1');

  // Parent percentage discount (e.g. FAMILY10) for logged-in user
  let percentOff: number | null = null;
  let priceAfterDiscount: number | null = null;
  if (user && !isFull && pricePerParticipant > 0) {
    const { data: pctRow } = await admin
      .from('parent_percentage_discounts')
      .select('percent_off')
      .eq('parent_id', user.id)
      .maybeSingle();
    percentOff = pctRow?.percent_off != null ? Number(pctRow.percent_off) : null;
    if (percentOff != null && percentOff >= 1 && percentOff <= 100) {
      priceAfterDiscount = pricePerParticipant * (1 - percentOff / 100);
    }
  }

  let youthWrestlers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    age?: number;
    weight_class?: string;
    skill_level?: string;
    hasValidCell: boolean;
  }> = [];
  if (user && !isFull) {
    const { data: primaryRows } = await supabase
      .from('youth_wrestlers')
      .select('id')
      .eq('parent_id', user.id)
      .eq('active', true);
    const { data: linkedRows } = await supabase
      .from('youth_wrestler_parents')
      .select('youth_wrestler_id')
      .eq('parent_id', user.id);
    const primaryIds = (primaryRows ?? []).map((r: { id: string }) => r.id);
    const linkedIds = (linkedRows ?? []).map((r: { youth_wrestler_id: string }) => r.youth_wrestler_id);
    const allIds = [...new Set([...primaryIds, ...linkedIds, user.id])];
    if (allIds.length > 0) {
      const { data: yw } = await supabase
        .from('youth_wrestlers')
        .select('id, first_name, last_name, age, weight_class, skill_level, phone')
        .in('id', allIds)
        .eq('active', true)
        .order('created_at', { ascending: false });
      youthWrestlers = (yw ?? []).map((row) => {
        const r = row as {
          id: string;
          first_name: string;
          last_name: string;
          age?: number;
          weight_class?: string;
          skill_level?: string;
          phone?: string | null;
        };
        return {
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          age: r.age,
          weight_class: r.weight_class,
          skill_level: r.skill_level,
          hasValidCell: hasMinPhoneDigits(r.phone),
        };
      });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>
            {isFull ? 'This session is already full' : 'Register for this session'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isFull
              ? 'The session you were invited to has reached the maximum number of participants.'
              : 'Sign in, choose your wrestler, and pay to register. Payment is collected in the app.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFull ? (
            <Button asChild>
              <Link href="/browse">Browse other sessions</Link>
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <ProfileImage
                  src={athlete?.photo_url}
                  alt={athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Coach'}
                  focusX={(athlete as { photo_focus_x?: number })?.photo_focus_x}
                  focusY={(athlete as { photo_focus_y?: number })?.photo_focus_y}
                  className="w-16 h-16 shrink-0"
                  fallbackIconClassName="h-8 w-8 text-muted-foreground"
                />
                <div>
                  <p className="font-semibold">{athlete?.first_name} {athlete?.last_name}</p>
                  <p className="text-sm text-muted-foreground">{athlete?.school}</p>
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                {dateTime}
              </p>
              {facility && (
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  {facility.name}
                  {facility.address && ` — ${facility.address}`}
                </p>
              )}
              {participantsList.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Registered ({participantsList.length}):</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {participantsList.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-lg font-bold">
                {priceAfterDiscount != null
                  ? `$${priceAfterDiscount.toFixed(2)} to join (${percentOff}% off)`
                  : `$${Number(pricePerParticipant).toFixed(2)} to join`}
              </p>

              {user ? (
                <JoinSessionClient
                  sessionId={session.id}
                  code={code}
                  isSmallGroup={isSmallGroup}
                  pricePerParticipant={pricePerParticipant}
                  priceAfterDiscount={priceAfterDiscount ?? undefined}
                  percentOff={percentOff ?? undefined}
                  youthWrestlers={youthWrestlers}
                />
              ) : (
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-muted-foreground">Sign up or log in to join this session.</p>
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/login?redirect=/join/${code}`}>Log in</Link>
                    </Button>
                    <Button asChild>
                      <Link href={`/signup?redirect=/join/${code}`}>Sign up</Link>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
