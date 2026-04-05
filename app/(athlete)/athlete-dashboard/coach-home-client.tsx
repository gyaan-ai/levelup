'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, CalendarPlus, Users, Star, BookUser } from 'lucide-react';
import { easternCalendarDaysBetween, formatEST } from '@/lib/format-date';
import { differenceInHours } from 'date-fns';
import { CoachPlaybook } from '@/components/coach-playbook';
import { CoachRankCard } from '@/components/coach-rank-card';
import {
  BookingCard,
  type BookingSession,
  type CoachTransferSessionOption,
} from '@/app/(parent)/bookings/booking-card';
import type { CoachSession } from './coach-schedule-card';

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

function wrestlerNames(s: CoachSession): string[] {
  const parts = s.session_participants ?? [];
  return parts
    .map((p) => {
      const yw = p.youth_wrestlers;
      const o = Array.isArray(yw) ? yw[0] : yw;
      return o && (o.first_name || o.last_name) ? [o.first_name, o.last_name].filter(Boolean).join(' ') : null;
    })
    .filter((n): n is string => Boolean(n));
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
    .filter((s) => s.id !== currentId)
    .map((s) => {
      const actualParticipants = Array.isArray(s.session_participants) ? s.session_participants.length : 0;
      const current = actualParticipants || s.current_participants || 0;
      return {
        id: s.id,
        scheduled_datetime: s.scheduled_datetime,
        facilityLabel: facilityName(s),
        current_participants: current,
        max_participants: s.max_participants ?? 1,
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
      wrestlers: wrestlerNames(session),
      primaryWrestlerId: primaryWrestlerId(session),
      joinPolicy: session.join_policy ?? null,
    },
    coachEarnings: { projected, max: maxEarn },
  };
}

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  users: { first_name: string } | null;
};

type Props = {
  coachId: string;
  upcomingSessions: CoachSession[];
  /** Total upcoming count (may be >5 while list is capped) */
  upcomingSessionsCount: number;
  pendingRequestsCount: number;
  thisMonthEarnings: number;
  coachFirstName?: string | null;
  /** Full name for booking cards (matches parent-facing coach line) */
  coachDisplayName: string;
  coachSchool?: string | null;
  coachPhotoUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  recentReviews?: Review[];
  payoutRate?: number;
  needsOnboarding?: boolean;
};

export function CoachHomeClient({
  coachId,
  upcomingSessions,
  upcomingSessionsCount,
  pendingRequestsCount,
  thisMonthEarnings,
  coachFirstName,
  coachDisplayName,
  coachSchool,
  coachPhotoUrl,
  averageRating,
  reviewCount = 0,
  recentReviews = [],
  payoutRate = 0.8333,
  needsOnboarding = false,
}: Props) {
  const coachBlock = {
    id: coachId,
    name: coachDisplayName,
    school: coachSchool ?? null,
    photo_url: coachPhotoUrl,
    average_rating: averageRating,
    review_count: reviewCount,
  };

  const nextSession = upcomingSessions[0];
  const reminderLabel = nextSession
    ? (() => {
        const d = new Date(nextSession.scheduled_datetime);
        const now = new Date();
        const hours = differenceInHours(d, now);
        const calendarDaysUntil = easternCalendarDaysBetween(now, d);
        if (hours <= 0) return null;
        if (hours < 24) return `Next session in ${hours}h · ${wrestlerNames(nextSession).join(', ') || 'Session'}`;
        if (calendarDaysUntil === 1) return `Tomorrow ${formatEST(d, 'h:mm a')} · ${wrestlerNames(nextSession).join(', ') || 'Session'}`;
        return `Next: ${formatEST(d, 'EEE MMM d, h:mm a')} · ${wrestlerNames(nextSession).join(', ') || 'Session'}`;
      })()
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Home</h1>
      <p className="text-muted-foreground text-sm md:text-base">
        {coachFirstName ? `Hey ${coachFirstName}, here's what's up.` : 'Your schedule and quick actions.'}
      </p>

      {/* Bookings · earnings · rating at a glance */}
      <Card className="border-border/80 bg-muted/20">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming bookings</p>
              <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{upcomingSessionsCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Scheduled sessions</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">This month</p>
              <p className="text-2xl font-bold text-[#D4AF37] tabular-nums mt-1">${thisMonthEarnings.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Completed session payouts</p>
              <Link href="/coach-earnings" className="text-xs text-accent font-medium mt-1 inline-block">
                Earnings details →
              </Link>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your rating</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold tabular-nums">{averageRating != null ? averageRating.toFixed(1) : '—'}</span>
                <span className="text-sm text-muted-foreground">({reviewCount} review{reviewCount !== 1 ? 's' : ''})</span>
              </div>
              <Link href="/coach-reviews" className="text-xs text-accent font-medium mt-1 inline-block">
                All reviews →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {reminderLabel && (
        <div className="rounded-lg border-2 border-accent/50 bg-accent/15 px-4 py-4">
          <p className="font-medium text-foreground">{reminderLabel}</p>
          <p className="text-sm text-muted-foreground mt-1.5">We&apos;ll remind you the day before and 1 hour before so you do not forget.</p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Your bookings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Same details parents see on My Bookings — who&apos;s signed up, time, place, and your estimated payout.
        </p>
        {upcomingSessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground font-medium mb-1">No sessions yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Parents can only book when you add times. Set your schedule below ↓
              </p>
              <Link href="/availability">
                <Button className="min-h-[44px] touch-manipulation">Set your schedule</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map((session) => {
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
        {upcomingSessionsCount > 5 && (
          <Link href="/coach-sessions" className="block mt-2 text-sm text-accent font-medium">
            View all {upcomingSessionsCount} sessions →
          </Link>
        )}
      </section>

      {pendingRequestsCount > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Someone wants to join
            </CardTitle>
            <CardDescription>
              {pendingRequestsCount} parent{pendingRequestsCount !== 1 ? 's' : ''} want{pendingRequestsCount === 1 ? 's' : ''} to join your session{pendingRequestsCount !== 1 ? 's' : ''}. Tap below to say yes or no.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/coach-sessions?tab=requests">
              <Button className="w-full min-h-[44px] touch-manipulation">Review requests</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <CoachRankCard coachId={coachId} />
      <CoachPlaybook />

      {needsOnboarding && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50">
          <p className="font-medium">Finish your coach profile</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Add a short bio and a few details so parents can book you. You can do this anytime.
          </p>
          <Button asChild className="mt-3 bg-amber-600 hover:bg-amber-700 text-black" size="sm">
            <Link href="/onboarding">Continue setup</Link>
          </Button>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">New reviews</h2>
          {reviewCount > 0 && (
            <Link href="/coach-reviews" className="text-sm text-accent font-medium">
              See all {reviewCount} →
            </Link>
          )}
        </div>
        {reviewCount === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-muted-foreground">No reviews yet</p>
              <p className="text-sm text-muted-foreground">Reviews will appear here after sessions</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {recentReviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-muted-foreground/30'}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {review.users?.first_name ?? 'Parent'}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link href="/coach-sessions/create">
            <Button className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5 bg-[#D4AF37] hover:bg-[#B8963C] text-black">
              <CalendarPlus className="h-4 w-4 shrink-0" />
              <span className="text-xs">Create Session</span>
            </Button>
          </Link>
          <Link href="/availability">
            <Button variant="outline" className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="text-xs">Schedule</span>
              <span className="text-[10px] font-normal text-muted-foreground">Set availability</span>
            </Button>
          </Link>
          <Link href="/coach-sessions">
            <Button variant="outline" className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5">
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-xs">Sessions</span>
              <span className="text-[10px] font-normal text-muted-foreground">View all</span>
            </Button>
          </Link>
          <Link href="/coach-roster">
            <Button variant="outline" className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5">
              <BookUser className="h-4 w-4 shrink-0" />
              <span className="text-xs">Roster</span>
              <span className="text-[10px] font-normal text-muted-foreground">Copy kid #s</span>
            </Button>
          </Link>
          <Link href="/coach-earnings">
            <Button variant="outline" className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5">
              <DollarSign className="h-4 w-4 shrink-0" />
              <span className="text-xs">Earnings</span>
              <span className="text-[10px] font-normal text-muted-foreground">${thisMonthEarnings.toFixed(0)} this month</span>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
