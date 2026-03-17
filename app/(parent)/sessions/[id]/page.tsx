import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { getParentYouthWrestlerIds } from '@/lib/parent-wrestlers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { ProfileImage } from '@/components/profile-image';
import { StarRating } from '@/components/star-rating';
import { SchoolLogo } from '@/components/school-logo';
import { formatEST } from '@/lib/format-date';
import { SessionDetailActions } from './session-detail-actions';
import { CapacityBadge } from '@/components/capacity-badge';
import { Calendar, User, MapPin, Users } from 'lucide-react';

export default async function SessionDetailPage({
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

  if (!user) {
    redirect('/login?redirect=' + encodeURIComponent(`/sessions/${sessionId}`));
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userData?.role;
  if (role !== 'parent' && role !== 'admin' && role !== 'coach') {
    redirect('/dashboard');
  }

  const sessionSelect = `
    id,
    parent_id,
    athlete_id,
    scheduled_datetime,
    status,
    total_price,
    price_per_participant,
    session_type,
    session_mode,
    focus_area,
    current_participants,
    max_participants,
    partner_invite_code,
    athletes(id, first_name, last_name, school, photo_url, average_rating, review_count, phone),
    facilities(id, name, address),
    session_participants(youth_wrestler_id, amount_paid, youth_wrestlers(id, first_name, last_name))
  `;

  const youthWrestlerIds = await getParentYouthWrestlerIds(supabase, user.id);

  let session: Record<string, unknown> | null = null;
  let adminErr: string | null = null;
  let fallbackCount = 0;
  try {
    const admin = createAdminClient(tenant.slug);
    const res = await admin.from('sessions').select(sessionSelect).eq('id', sessionId).single();
    if (!res.error && res.data) session = res.data;
    else if (res.error) adminErr = res.error.message || res.error.code || String(res.error);
  } catch (e) {
    adminErr = e instanceof Error ? e.message : String(e);
  }
  if (!session) {
    let familySessionIds: string[] = [];
    if (youthWrestlerIds.length > 0) {
      const { data: partRows } = await supabase
        .from('session_participants')
        .select('session_id')
        .in('youth_wrestler_id', youthWrestlerIds);
      familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
    }
    const idsToFetch = [...new Set([...familySessionIds, sessionId])];
    const { data: sessionsList } = await supabase
      .from('sessions')
      .select(sessionSelect)
      .in('id', idsToFetch);
    fallbackCount = sessionsList?.length ?? 0;
    session = sessionsList?.find((row) => (row as { id: string }).id === sessionId) ?? null;
  }
  if (!session) {
    console.error('[sessions/[id]] 404', { sessionId, userId: user.id, adminErr, youthCount: youthWrestlerIds.length, fallbackRows: fallbackCount });
    notFound();
  }

  const s = session as {
    parent_id?: string;
    athlete_id?: string;
    scheduled_datetime?: string;
    status?: string;
    total_price?: number;
    price_per_participant?: number | null;
    session_type?: string;
    session_mode?: string;
    focus_area?: string | null;
    focus_area_2?: string | null;
    current_participants?: number;
    max_participants?: number;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string | null; average_rating?: number | null; review_count?: number | null; phone?: string | null } | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string | null; average_rating?: number | null; review_count?: number | null; phone?: string | null }[];
    facilities?: { id: string; name?: string; address?: string | null } | { id: string; name?: string; address?: string | null }[];
    session_participants?: Array<{
      youth_wrestler_id?: string;
      amount_paid?: number | null;
      youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
    }>;
  };

  const isAdmin = role === 'admin';
  const isOwner = s.parent_id === user.id;
  const isCoach = s.athlete_id === user.id;
  const participantYouthIds = (s.session_participants ?? [])
    .map((p) => p.youth_wrestler_id)
    .filter(Boolean) as string[];
  const isParticipant = youthWrestlerIds.some((id) => participantYouthIds.includes(id));

  // Allow view if session exists and user has a valid role (link = permission; no extra gate so View never 404s)

  const scheduledTime = s.scheduled_datetime ? new Date(s.scheduled_datetime) : null;
  const now = new Date();
  const isPast =
    s.status === 'completed' ||
    s.status === 'cancelled' ||
    s.status === 'no-show' ||
    (scheduledTime != null && scheduledTime < now);

  const canCancel =
    !isPast &&
    (s.status === 'scheduled' || s.status === 'pending_payment') &&
    scheduledTime != null &&
    scheduledTime > now &&
    isOwner;
  const canLeave = canCancel && !isOwner;

  const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
  const coachName = coach
    ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() || 'Coach'
    : 'Coach';
  const coachPhone = coach && 'phone' in coach ? (coach.phone as string | null) : null;
  const coachIdForLink = (coach?.id && String(coach.id).trim()) || (s.athlete_id && String(s.athlete_id).trim()) || null;
  const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
  const facilityName = fac?.name ?? '—';
  const facilityAddress = fac?.address ?? null;

  const participantsList = (s.session_participants ?? [])
    .map((p) => {
      const yw = p.youth_wrestlers;
      const o = Array.isArray(yw) ? yw[0] : yw;
      return o ? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() : null;
    })
    .filter(Boolean) as string[];

  const current = s.current_participants ?? 0;
  const max = s.max_participants ?? 1;
  const openings = Math.max(0, max - current);

  let amountPaid = 0;
  const myParticipantIds = new Set(youthWrestlerIds);
  for (const p of s.session_participants ?? []) {
    if (!p.youth_wrestler_id || !myParticipantIds.has(p.youth_wrestler_id)) continue;
    const amt = p.amount_paid;
    if (amt != null && Number(amt) > 0) amountPaid += Number(amt);
  }

  const pastSessionIds = isPast && s.status === 'completed' ? [sessionId] : [];
  const { data: myReviews } = pastSessionIds.length > 0
    ? await supabase
        .from('reviews')
        .select('session_id')
        .eq('parent_id', user.id)
        .in('session_id', pastSessionIds)
    : { data: [] };
  const hasReviewed = (myReviews ?? []).length > 0;

  const statusBadge = (status: string) => {
    if (status === 'scheduled') return <Badge>Scheduled</Badge>;
    if (status === 'pending_payment') return <Badge variant="secondary">Pending payment</Badge>;
    if (status === 'completed') return <Badge variant="default">Completed</Badge>;
    if (status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>;
    if (status === 'no-show') return <Badge variant="secondary">No-show</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <Link
        href="/bookings"
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
      >
        ← Back to My bookings
      </Link>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <ProfileImage
              src={coach?.photo_url ?? null}
              alt={coachName}
              className="w-14 h-14 shrink-0 rounded-full object-cover border border-border"
              fallbackIconClassName="h-7 w-7 text-muted-foreground"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                <SessionTypeBadge sessionType={s.session_type} sessionMode={s.session_mode} />
                {(s.focus_area || s.focus_area_2) && (
                  <Badge variant="secondary" className="font-normal text-xs">
                    {[s.focus_area, s.focus_area_2].filter(Boolean).join(', ')}
                  </Badge>
                )}
                {max > 1 && (
                  <CapacityBadge current={current} max={max} label="" />
                )}
                {s.status && statusBadge(s.status)}
              </CardTitle>
              <p className="font-semibold text-foreground">
                {scheduledTime
                  ? formatEST(scheduledTime, 'EEEE, MMM d, yyyy')
                  : '—'}
                {scheduledTime && ` · ${formatEST(scheduledTime, 'h:mm a')}`}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="font-medium text-foreground">{facilityName}</span>
            </p>
            {facilityAddress && (
              <p className="pl-6 text-muted-foreground">{facilityAddress}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            {coachIdForLink ? (
              <Link
                href={`/athlete/${coachIdForLink}`}
                className="font-medium text-foreground hover:underline"
              >
                {coachName}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{coachName}</span>
            )}
            {coach?.school && (
              <span className="flex items-center gap-1">
                <SchoolLogo school={coach.school} size="sm" />
                <span className="text-muted-foreground/80">({coach.school})</span>
              </span>
            )}
            {coachIdForLink && (
              <Link href={`/athlete/${coachIdForLink}`} className="text-xs text-accent hover:underline">
                View profile
              </Link>
            )}
          </div>
          <StarRating
            averageRating={coach?.average_rating ?? null}
            reviewCount={coach?.review_count ?? null}
            size="sm"
          />
          {coachPhone && (
            <p className="text-sm text-muted-foreground">
              Coach: <a href={`tel:${coachPhone}`} className="text-foreground hover:underline">{coachPhone}</a>
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            {max > 1 ? (
              <CapacityBadge current={current} max={max} label="registered" />
            ) : (
              <span className="text-sm font-medium text-foreground">{current} registered</span>
            )}
            {max > 1 && (
              <span className="text-sm text-muted-foreground">
                {openings} opening{openings !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {participantsList.length > 0 && (
            <p className="text-sm text-muted-foreground pl-6">
              {participantsList.join(', ')}
            </p>
          )}

          <div className="pt-2">
            <p className="text-sm font-semibold text-foreground">
              {amountPaid > 0
                ? `You paid $${Number(amountPaid).toFixed(2)}`
                : s.total_price != null && s.total_price > 0
                  ? `$${Number(s.total_price).toFixed(2)}`
                  : s.price_per_participant != null && s.price_per_participant > 0
                    ? `$${Number(s.price_per_participant).toFixed(2)} / person`
                    : '—'}
            </p>
          </div>

          <div className="pt-2 border-t">
            <SessionDetailActions
              sessionId={sessionId}
              isPast={isPast}
              isOwner={isOwner}
              canLeave={canLeave}
              canCancel={!!canCancel}
              scheduledDatetime={s.scheduled_datetime ?? ''}
              totalPrice={s.total_price ?? 0}
              status={s.status ?? 'scheduled'}
              hasReviewed={hasReviewed}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
