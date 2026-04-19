'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Check, Link2, Loader2, MessageCircle, Smartphone, X } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { COACH_REVENUE_FRACTION } from '@/lib/pricing';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import {
  BookingCard,
  type BookingSession,
  type CoachTransferSessionOption,
} from '@/app/(parent)/bookings/booking-card';
import type { CoachSession } from './coach-schedule-card';
import { splitCoachSessionsByToday } from '@/lib/coach-schedule-split';

function facilityName(s: CoachSession): string {
  const f = s.facilities;
  if (!f || typeof f !== 'object') return '—';
  const arr = Array.isArray(f) ? f : [f];
  const first = arr[0] as { name?: string } | null;
  return first?.name ?? '—';
}

function facilityId(s: CoachSession): string | null {
  const f = s.facilities;
  if (!f || typeof f !== 'object') return null;
  const arr = Array.isArray(f) ? f : [f];
  const id = (arr[0] as { id?: string })?.id;
  return id && String(id).trim() ? String(id) : null;
}

function wrestlerFullNames(s: CoachSession): string[] {
  const parts = s.session_participants ?? [];
  return parts
    .map((p) => {
      const yw = p.youth_wrestlers;
      const o = Array.isArray(yw) ? yw[0] : yw;
      return o && (o.first_name || o.last_name)
        ? [o.first_name, o.last_name].filter(Boolean).join(' ').trim()
        : null;
    })
    .filter((n): n is string => Boolean(n));
}

function participantCount(s: CoachSession): number {
  const fromRows = Array.isArray(s.session_participants) ? s.session_participants.length : 0;
  return Math.max(fromRows, s.current_participants ?? 0);
}

function primaryWrestlerId(s: CoachSession): string | null {
  const parts = s.session_participants ?? [];
  const first = parts[0];
  return first ? (first as { youth_wrestler_id?: string }).youth_wrestler_id ?? null : null;
}

function coachTransferOptionsForSession(
  all: CoachSession[],
  currentId: string
): CoachTransferSessionOption[] {
  return all
    .filter((x) => x.id !== currentId)
    .map((x) => {
      const actualParticipants = Array.isArray(x.session_participants) ? x.session_participants.length : 0;
      const current = actualParticipants || x.current_participants || 0;
      return {
        id: x.id,
        scheduled_datetime: x.scheduled_datetime,
        facilityLabel: facilityName(x),
        current_participants: current,
        max_participants: x.max_participants ?? 1,
      };
    });
}

function isTentativeSession(s: CoachSession, current: number): boolean {
  const max = s.max_participants ?? 1;
  if (current >= max) return false;
  const isGroup = s.session_type === 'group' || s.session_type === 'small_group';
  const isPartnerOpen = s.session_mode === 'partner-open';
  return isGroup || isPartnerOpen;
}

function toCoachBooking(
  session: CoachSession,
  coach: {
    id: string;
    name: string;
    school: string | null;
    photo_url: string | null | undefined;
    average_rating: number | null | undefined;
    review_count: number;
  },
  payoutRate: number
): { session: BookingSession; coachEarnings: { projected: number; max: number } } {
  const actualParticipants = Array.isArray(session.session_participants) ? session.session_participants.length : 0;
  const current = actualParticipants || session.current_participants || 0;
  const max = session.max_participants ?? 1;
  const pricePerParticipant = Number(session.price_per_participant ?? 0);
  const projected = Math.round(current * pricePerParticipant * payoutRate * 100) / 100;
  const maxEarn = Math.round(max * pricePerParticipant * payoutRate * 100) / 100;

  return {
    session: {
      id: session.id,
      scheduled_datetime: session.scheduled_datetime,
      status: session.status,
      total_price: Number(session.total_price ?? 0),
      price_per_participant: session.price_per_participant != null ? Number(session.price_per_participant) : undefined,
      session_type: session.session_type,
      session_mode: session.session_mode,
      focus_area: session.focus_area ?? null,
      focus_area_2: session.focus_area_2 ?? null,
      current_participants: current,
      max_participants: max,
      partner_invite_code: session.partner_invite_code ?? null,
      isTentative: isTentativeSession(session, current),
      isOwner: true,
      coach: {
        name: coach.name,
        school: coach.school ?? '',
        id: coach.id,
        photo_url: coach.photo_url,
        average_rating: coach.average_rating ?? null,
        review_count: coach.review_count,
      },
      facility: facilityName(session),
      facility_id: facilityId(session),
      wrestlers: wrestlerFullNames(session),
      primaryWrestlerId: primaryWrestlerId(session),
      joinPolicy: session.join_policy ?? null,
    },
    coachEarnings: { projected, max: maxEarn },
  };
}

export type JoinRequestItem = {
  id: string;
  session_id: string;
  message?: string;
  status: string;
  created_at: string;
  youth_wrestler_id: string;
  youth_wrestlers?: { id: string; first_name?: string; last_name?: string } | null;
  session?: {
    id: string;
    scheduled_datetime: string;
    session_type?: string;
    session_mode?: string;
    facilities?: { name?: string } | null;
  };
};

export type SlotRequestScheduleItem = {
  id: string;
  requesting_parent_id: string;
  youth_wrestler_id: string;
  coach_id: string;
  facility_id: string | null;
  preferred_datetime: string | null;
  session_type: string | null;
  message: string | null;
  flexibility_note: string | null;
  status: string;
  created_at: string;
  youth_wrestlers?: { id: string; first_name?: string; last_name?: string } | null;
  facilities?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
};

type Props = {
  coachId: string;
  upcomingSessions: CoachSession[];
  upcomingSessionsCount: number;
  pendingJoinRequests: JoinRequestItem[];
  pendingSlotRequests: SlotRequestScheduleItem[];
  coachFirstName?: string | null;
  coachDisplayName: string;
  coachSchool?: string | null;
  coachPhotoUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  payoutRate?: number;
};

function sessionTypeWords(sessionType?: string | null): string {
  if (!sessionType) return 'Session';
  return sessionType.replace(/_/g, ' ');
}

async function openSmsForPhones(sessionId: string, kind: 'parents' | 'athletes') {
  try {
    const r = await fetch(`/api/sessions/${sessionId}/sms-phones`);
    const data = (await r.json()) as {
      commaParents?: string;
      commaAthletes?: string;
      error?: string;
    };
    if (!r.ok) {
      window.alert(data.error || 'Could not load numbers.');
      return;
    }
    const raw = kind === 'parents' ? data.commaParents : data.commaAthletes;
    const phones = (raw ?? '')
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      window.alert(kind === 'parents' ? 'No parent numbers on file yet.' : 'No athlete numbers on file yet.');
      return;
    }
    const [first, ...rest] = phones;
    if (rest.length > 0) {
      await copyTextToClipboard(rest.join('\n'));
    }
    window.location.href = `sms:${first}`;
  } catch {
    window.alert('Something went wrong. Try again.');
  }
}

export function CoachScheduleClient({
  coachId,
  upcomingSessions,
  upcomingSessionsCount,
  pendingJoinRequests,
  pendingSlotRequests,
  coachFirstName,
  coachDisplayName,
  coachSchool,
  coachPhotoUrl,
  averageRating,
  reviewCount = 0,
  payoutRate = COACH_REVENUE_FRACTION,
}: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [slotNoteById, setSlotNoteById] = useState<Record<string, string>>({});

  const now = new Date();
  const { today, upcoming } = splitCoachSessionsByToday(upcomingSessions, now);

  const coachBlock = {
    id: coachId,
    name: coachDisplayName,
    school: coachSchool ?? null,
    photo_url: coachPhotoUrl,
    average_rating: averageRating,
    review_count: reviewCount,
  };

  const handleCopyShare = async (sessionId: string) => {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    await copyTextToClipboard(url);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Session', url });
      } catch {
        /* user cancelled */
      }
    }
  };

  const handleApproveDecline = async (requestId: string, sessionId: string, action: 'approve' | 'decline') => {
    setLoadingId(requestId);
    try {
      const res = await fetch(`/api/session-join-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      router.refresh();
      window.dispatchEvent(new Event('coach-pending-refresh'));
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoadingId(null);
    }
  };

  const handleSlotRespond = async (requestId: string, action: 'approve' | 'decline') => {
    setLoadingId(requestId);
    try {
      const res = await fetch(`/api/parent-session-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'approve' ? 'approve' : 'decline',
          coachResponse: slotNoteById[requestId]?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      router.refresh();
      window.dispatchEvent(new Event('coach-pending-refresh'));
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoadingId(null);
    }
  };

  const showPending = pendingJoinRequests.length > 0 || pendingSlotRequests.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Schedule</h1>
            <Link
              href="/coach-dashboard"
              className="text-sm font-semibold text-[#D4AF37] hover:underline whitespace-nowrap"
            >
              Dashboard →
            </Link>
          </div>
          <p className="text-muted-foreground text-sm md:text-base mt-1">
            {coachFirstName ? `Hey ${coachFirstName}` : 'Your sessions'} — who&apos;s booked, what&apos;s pending.
          </p>
        </div>
        <Button
          asChild
          className="min-h-[44px] touch-manipulation bg-[#D4AF37] hover:bg-[#c9a432] text-black font-semibold shrink-0 w-full sm:w-auto"
        >
          <Link href="/coach-sessions/create">
            <CalendarPlus className="h-4 w-4 mr-2" />
            Create
          </Link>
        </Button>
      </div>

      {today.length > 0 && (
        <section className="space-y-3" aria-label="Today">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today — {formatEST(now, 'EEEE, MMM d')}
          </h2>
          <div className="space-y-3">
            {today.map((session) => {
              const names = wrestlerFullNames(session);
              const n = participantCount(session);
              const max = session.max_participants ?? 1;
              const dur = (session as { duration_minutes?: number }).duration_minutes ?? 60;
              const rosterOk = n === 0 || names.length > 0;
              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 dark:bg-[#D4AF37]/15 px-4 py-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SessionTypeBadge sessionType={session.session_type} sessionMode={session.session_mode} />
                    <span className="text-sm text-muted-foreground">{dur} min</span>
                  </div>
                  <p className="font-semibold text-foreground">
                    {formatEST(session.scheduled_datetime, 'h:mm a')}
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      · {sessionTypeWords(session.session_type)} · {facilityName(session)}
                    </span>
                  </p>
                  <div className="border-t border-[#D4AF37]/25 pt-3">
                    {!rosterOk ? (
                      <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                        Loading roster… if this persists, open the session detail.
                      </p>
                    ) : n === 0 ? (
                      <p className="text-sm text-muted-foreground">No athletes booked yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {names.map((name) => (
                          <li key={name} className="text-base font-medium text-foreground flex items-center gap-2">
                            <span className="text-muted-foreground" aria-hidden>
                              👤
                            </span>
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                    {max > 1 && n > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {n}/{max} filled
                        {n < max ? ` — ${max - n} spot${max - n !== 1 ? 's' : ''} open` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px] touch-manipulation bg-background/80 border-border"
                      onClick={() => handleCopyShare(session.id)}
                    >
                      <Link2 className="h-4 w-4 mr-2 shrink-0" />
                      Share link
                    </Button>
                    {n > 0 && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] touch-manipulation border-[#D4AF37]/50"
                          onClick={() => openSmsForPhones(session.id, 'athletes')}
                        >
                          <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
                          Text athletes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] touch-manipulation border-[#D4AF37]/50"
                          onClick={() => openSmsForPhones(session.id, 'parents')}
                        >
                          <Smartphone className="h-4 w-4 mr-2 shrink-0" />
                          Text parents
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showPending && (
        <section className="space-y-3" aria-label="Pending approval">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Pending approval ({pendingJoinRequests.length + pendingSlotRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingJoinRequests.map((r) => {
              const yw = r.youth_wrestlers;
              const name = yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ').trim() : 'Athlete';
              const sess = r.session;
              const when = sess?.scheduled_datetime
                ? `${formatEST(new Date(sess.scheduled_datetime), 'EEE MMM d')} · ${formatEST(new Date(sess.scheduled_datetime), 'h:mm a')}`
                : '—';
              const fac = sess?.facilities;
              const facName = fac ? (fac as { name?: string }).name ?? '—' : '—';
              const typeLabel = sessionTypeWords(sess?.session_type);
              return (
                <Card key={r.id} className="border-amber-500/40 bg-amber-500/5">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-medium text-foreground">{name} wants to join</p>
                    <p className="text-sm text-muted-foreground">
                      {when} · {typeLabel} · {facName}
                    </p>
                    {r.message ? (
                      <p className="text-sm text-muted-foreground">&ldquo;{r.message}&rdquo;</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="min-h-[44px] touch-manipulation"
                        onClick={() => handleApproveDecline(r.id, r.session_id, 'approve')}
                        disabled={loadingId === r.id}
                      >
                        {loadingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] touch-manipulation text-destructive border-destructive"
                        onClick={() => handleApproveDecline(r.id, r.session_id, 'decline')}
                        disabled={loadingId === r.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {pendingSlotRequests.map((r) => {
              const ywRaw = r.youth_wrestlers;
              const yw = Array.isArray(ywRaw) ? ywRaw[0] : ywRaw;
              const name = yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ').trim() : 'Athlete';
              const fac = r.facilities;
              const facName = fac
                ? (Array.isArray(fac) ? (fac[0] as { name?: string })?.name : (fac as { name?: string })?.name) ?? '—'
                : '—';
              const when = r.preferred_datetime
                ? `${formatEST(new Date(r.preferred_datetime), 'EEE MMM d')} · ${formatEST(new Date(r.preferred_datetime), 'h:mm a')}`
                : 'Time TBD';
              return (
                <Card key={r.id} className="border-amber-500/40 bg-amber-500/5">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-medium text-foreground">{name} — session request</p>
                    <p className="text-sm text-muted-foreground">
                      {when} · {sessionTypeWords(r.session_type)} · {facName}
                    </p>
                    {r.message ? <p className="text-sm text-muted-foreground">&ldquo;{r.message}&rdquo;</p> : null}
                    <label className="block text-xs text-muted-foreground" htmlFor={`slot-${r.id}`}>
                      Optional note to parent
                    </label>
                    <textarea
                      id={`slot-${r.id}`}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={slotNoteById[r.id] ?? ''}
                      onChange={(e) => setSlotNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="min-h-[44px] touch-manipulation"
                        onClick={() => handleSlotRespond(r.id, 'approve')}
                        disabled={loadingId === r.id}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] touch-manipulation text-destructive border-destructive"
                        onClick={() => handleSlotRespond(r.id, 'decline')}
                        disabled={loadingId === r.id}
                      >
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3 scroll-mt-4" aria-label="Upcoming sessions">
        <h2 className="text-lg font-semibold text-foreground">Upcoming</h2>
        {upcoming.length === 0 && today.length === 0 && upcomingSessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-muted-foreground font-medium">No upcoming sessions.</p>
              <p className="text-sm text-muted-foreground">Create one now so parents can book or use your share link.</p>
              <Button asChild className="min-h-[44px] touch-manipulation bg-[#D4AF37] hover:bg-[#c9a432] text-black">
                <Link href="/coach-sessions/create">
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Create session
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                <Link href="/availability" className="text-accent font-medium underline">
                  Set availability
                </Link>{' '}
                for calendar bookings ·{' '}
                <Link href="/coach-sessions" className="text-accent font-medium underline">
                  All sessions
                </Link>
              </p>
            </CardContent>
          </Card>
        ) : upcoming.length === 0 && today.length > 0 ? (
          <p className="text-sm text-muted-foreground">No later sessions — everything for today is above.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((session) => {
              const { session: bookingSession, coachEarnings } = toCoachBooking(session, coachBlock, payoutRate);
              return (
                <BookingCard
                  key={session.id}
                  session={bookingSession}
                  variant="coach"
                  coachEarnings={coachEarnings}
                  coachTransferSessionOptions={coachTransferOptionsForSession(upcomingSessions, session.id)}
                />
              );
            })}
          </div>
        )}
        {upcomingSessionsCount > upcomingSessions.length && (
          <Link href="/coach-sessions" className="block text-sm text-accent font-medium">
            View all {upcomingSessionsCount} upcoming sessions →
          </Link>
        )}
      </section>
    </div>
  );
}
