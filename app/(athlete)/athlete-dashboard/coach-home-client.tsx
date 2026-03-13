'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, MessageCircle, CalendarPlus, Users, FolderOpen } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { differenceInHours, differenceInDays } from 'date-fns';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';
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

type Props = {
  upcomingSessions: CoachSession[];
  pendingRequestsCount: number;
  thisMonthEarnings: number;
  coachFirstName?: string | null;
};

export function CoachHomeClient({
  upcomingSessions,
  pendingRequestsCount,
  thisMonthEarnings,
  coachFirstName,
}: Props) {
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
          <p className="text-sm text-muted-foreground mt-1.5">We’ll remind you the day before and 1 hour before so you do not forget.</p>
        </div>
      )}

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
            {upcomingSessions.slice(0, 5).map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {formatEST(new Date(session.scheduled_datetime), 'EEE, MMM d')} · {formatEST(new Date(session.scheduled_datetime), 'h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {facilityName(session)}
                        {wrestlerNames(session).length > 0 && ` · ${wrestlerNames(session).join(', ')}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <AddToCalendarButton
                        sessionId={session.id}
                        title={`Session ${wrestlerNames(session).join(', ') || 'with athlete'}`}
                        start={session.scheduled_datetime}
                        location={facilityName(session)}
                        size="sm"
                        className="min-h-[44px] touch-manipulation"
                      />
                      <Link href={`/messages/${session.id}`}>
                        <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                      </Link>
                      <Link href={`/workspaces/from-session/${session.id}`} className="hidden sm:block">
                        <Button variant="ghost" size="sm" className="min-h-[44px] touch-manipulation">
                          <FolderOpen className="h-4 w-4 mr-1" />
                          Workspace
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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

      {/* Quick actions — super simple labels */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/availability">
            <Button variant="outline" className="w-full min-h-[48px] touch-manipulation flex flex-col gap-0.5">
              <Calendar className="h-5 w-5 shrink-0" />
              <span>Set your schedule</span>
              <span className="text-xs font-normal text-muted-foreground">When can you coach?</span>
            </Button>
          </Link>
          <Link href="/small-group-sessions">
            <Button variant="outline" className="w-full min-h-[48px] touch-manipulation flex flex-col gap-0.5">
              <Users className="h-5 w-5 shrink-0" />
              <span>Create group session</span>
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="outline" className="w-full min-h-[48px] touch-manipulation flex flex-col gap-0.5">
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
