'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, CalendarPlus, Users, Share2, Star, Check } from 'lucide-react';
import { CopySessionPhonesButton } from '@/components/copy-session-phones-button';
import { useState } from 'react';
import { formatEST } from '@/lib/format-date';
import { differenceInHours, differenceInDays } from 'date-fns';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { SessionContactsPanel } from '@/components/session-contacts-panel';
import { CoachPlaybook } from '@/components/coach-playbook';
import type { CoachSession } from './coach-schedule-card';

function facilityName(s: CoachSession): string {
  const f = s.facilities;
  if (!f || typeof f !== 'object') return '—';
  const arr = Array.isArray(f) ? f : [f];
  const first = arr[0] as { name?: string } | null;
  return first?.name ?? '—';
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

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  users: { first_name: string } | null;
};

type Props = {
  upcomingSessions: CoachSession[];
  pendingRequestsCount: number;
  thisMonthEarnings: number;
  coachFirstName?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  recentReviews?: Review[];
  payoutRate?: number;
};

export function CoachHomeClient({
  upcomingSessions,
  pendingRequestsCount,
  thisMonthEarnings,
  coachFirstName,
  averageRating,
  reviewCount = 0,
  recentReviews = [],
  payoutRate = 0.8333,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = async (sessionId: string) => {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const nextSession = upcomingSessions[0];
  const reminderLabel = nextSession
    ? (() => {
        const d = new Date(nextSession.scheduled_datetime);
        const hours = differenceInHours(d, new Date());
        const days = differenceInDays(d, new Date());
        if (hours <= 0) return null;
        if (hours < 24) return `Next session in ${hours}h · ${wrestlerNames(nextSession).join(', ') || 'Session'}`;
        if (days === 1) return `Tomorrow ${formatEST(d, 'h:mm a')} · ${wrestlerNames(nextSession).join(', ') || 'Session'}`;
        return `Next: ${formatEST(d, 'EEE MMM d, h:mm a')} · ${wrestlerNames(nextSession).join(', ') || 'Session'}`;
      })()
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Home</h1>
      <p className="text-muted-foreground text-sm md:text-base">
        {coachFirstName ? `Hey ${coachFirstName}, here’s what’s up.` : 'Your schedule and quick actions.'}
      </p>

{/* Next session reminder — prominent so college kids do not forget */}
      {reminderLabel && (
        <div className="rounded-lg border-2 border-accent/50 bg-accent/15 px-4 py-4">
          <p className="font-medium text-foreground">{reminderLabel}</p>
          <p className="text-sm text-muted-foreground mt-1.5">We&apos;ll remind you the day before and 1 hour before so you do not forget.</p>
        </div>
      )}

      {/* Coach Playbook - actionable outreach items */}
      <CoachPlaybook />

      {/* Upcoming sessions */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Upcoming</h2>
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
            {upcomingSessions.slice(0, 5).map((session) => {
              const current = session.current_participants ?? 0;
              const max = session.max_participants ?? 1;
              const pricePerParticipant = Number(session.price_per_participant ?? 0);
              const projectedEarnings = Math.round(current * pricePerParticipant * payoutRate * 100) / 100;
              const isFull = current >= max;
              const showSpotsCount = session.session_type === 'group' || session.session_type === 'partner' || max > 1;
              
              return (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <SessionTypeBadge sessionType={session.session_type} sessionMode={session.session_mode} />
                        {showSpotsCount && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isFull 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : current === 0 
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {current}/{max} spots
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-foreground">
                        {formatEST(new Date(session.scheduled_datetime), 'EEE, MMM d')} · {formatEST(new Date(session.scheduled_datetime), 'h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {facilityName(session)}
                        {wrestlerNames(session).length > 0 && ` · ${wrestlerNames(session).join(', ')}`}
                      </p>
                      {current > 0 && (
                        <p className="text-sm font-medium text-[#D4AF37] mt-1">
                          Projected: ${projectedEarnings.toFixed(0)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] touch-manipulation"
                        onClick={() => handleCopyLink(session.id)}
                      >
                        {copiedId === session.id ? (
                          <>
                            <Check className="h-4 w-4 mr-1 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Share2 className="h-4 w-4 mr-1" />
                            Share
                          </>
                        )}
                      </Button>
                      <AddToCalendarButton
                        sessionId={session.id}
                        title={`Session ${wrestlerNames(session).join(', ') || 'with athlete'}`}
                        start={session.scheduled_datetime}
                        location={facilityName(session)}
                        size="sm"
                        className="min-h-[44px] touch-manipulation"
                      />
                      <CopySessionPhonesButton
                        sessionId={session.id}
                        className="min-h-[44px] touch-manipulation"
                      />
                    </div>
                  </div>
                  
                  {/* Expandable contact info */}
                  <SessionContactsPanel
                    sessionId={session.id}
                    participantCount={current}
                  />
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
        {upcomingSessions.length > 5 && (
          <Link href="/coach-sessions" className="block mt-2 text-sm text-accent font-medium">
            View all sessions →
          </Link>
        )}
      </section>

      {/* Session requests — simple language for college kids */}
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

      {/* Reviews section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Reviews</h2>
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
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-[#D4AF37] text-[#D4AF37]" />
                  <span className="text-xl font-bold">{averageRating?.toFixed(1) ?? '—'}</span>
                </div>
                <span className="text-muted-foreground">({reviewCount} review{reviewCount !== 1 ? 's' : ''})</span>
              </div>
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

      {/* Quick actions — super simple labels */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/coach-sessions/create">
            <Button className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5 bg-[#D4AF37] hover:bg-[#B8963C] text-black">
              <CalendarPlus className="h-5 w-5 shrink-0" />
              <span>Create Session</span>
            </Button>
          </Link>
          <Link href="/availability">
            <Button variant="outline" className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5">
              <Calendar className="h-5 w-5 shrink-0" />
              <span>Schedule</span>
              <span className="text-xs font-normal text-muted-foreground">Set availability</span>
            </Button>
          </Link>
          <Link href="/coach-sessions">
            <Button variant="outline" className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5">
              <Users className="h-5 w-5 shrink-0" />
              <span>Sessions</span>
              <span className="text-xs font-normal text-muted-foreground">View all</span>
            </Button>
          </Link>
          <Link href="/coach-earnings">
            <Button variant="outline" className="w-full min-h-[56px] touch-manipulation flex flex-col gap-0.5">
              <DollarSign className="h-5 w-5 shrink-0" />
              <span>Earnings</span>
              <span className="text-xs font-normal text-muted-foreground">${thisMonthEarnings.toFixed(0)} this month</span>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
