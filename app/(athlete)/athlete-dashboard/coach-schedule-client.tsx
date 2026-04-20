'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarClock, CalendarPlus, Check, CircleHelp, Loader2, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatEST } from '@/lib/format-date';
import { formatSlotDisplay } from '@/lib/availability';
import { COACH_REVENUE_FRACTION } from '@/lib/pricing';
import type { CoachSession } from './coach-schedule-card';
import { splitCoachSessionsByToday } from '@/lib/coach-schedule-split';
import { getSessionTypeDisplay } from '@/components/session-type-badge';
import { CoachScheduleSessionCard } from './coach-schedule-session-card';

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
    session_type?: string | null;
    session_mode?: string | null;
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
  duration_minutes?: number | null;
  message: string | null;
  flexibility_note: string | null;
  status: string;
  created_at: string;
  youth_wrestlers?: { id: string; first_name?: string; last_name?: string } | null;
  facilities?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
};

type Props = {
  upcomingSessions: CoachSession[];
  upcomingSessionsCount: number;
  pendingJoinRequests: JoinRequestItem[];
  pendingSlotRequests: SlotRequestScheduleItem[];
  coachFirstName?: string | null;
  coachDisplayName: string;
  payoutRate?: number;
};

function sessionTypeLabel(sessionType?: string | null, sessionMode?: string | null): string {
  return getSessionTypeDisplay(sessionType, sessionMode).label;
}

export function CoachScheduleClient({
  upcomingSessions,
  upcomingSessionsCount,
  pendingJoinRequests,
  pendingSlotRequests,
  coachFirstName,
  coachDisplayName,
  payoutRate = COACH_REVENUE_FRACTION,
}: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [slotNoteById, setSlotNoteById] = useState<Record<string, string>>({});
  const [counterForId, setCounterForId] = useState<string | null>(null);
  const [counterDateById, setCounterDateById] = useState<Record<string, string>>({});
  const [counterTimeById, setCounterTimeById] = useState<Record<string, string>>({});
  const [counterSlotsById, setCounterSlotsById] = useState<Record<string, string[]>>({});
  const [counterSlotsLoadingId, setCounterSlotsLoadingId] = useState<string | null>(null);
  const [counterNoteById, setCounterNoteById] = useState<Record<string, string>>({});

  const counterDateActive = counterForId ? counterDateById[counterForId] : undefined;
  const counterCoachIdActive = counterForId
    ? pendingSlotRequests.find((x) => x.id === counterForId)?.coach_id
    : undefined;

  useEffect(() => {
    if (!counterForId || !counterDateActive || !counterCoachIdActive) return;
    let cancelled = false;
    setCounterSlotsLoadingId(counterForId);
    fetch(
      `/api/availability/slots?athleteId=${encodeURIComponent(counterCoachIdActive)}&date=${encodeURIComponent(counterDateActive)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.slots) ? (data.slots as string[]) : [];
        setCounterSlotsById((prev) => ({ ...prev, [counterForId]: list }));
        setCounterTimeById((prev) => {
          const cur = prev[counterForId];
          if (cur && list.includes(cur)) return prev;
          return { ...prev, [counterForId]: '' };
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCounterSlotsById((prev) => ({ ...prev, [counterForId]: [] }));
          setCounterTimeById((prev) => ({ ...prev, [counterForId]: '' }));
        }
      })
      .finally(() => {
        if (!cancelled) setCounterSlotsLoadingId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [counterForId, counterDateActive, counterCoachIdActive]);

  const now = new Date();
  const { today, upcoming } = splitCoachSessionsByToday(upcomingSessions, now);

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
    if (action === 'decline') {
      if (!window.confirm('Decline this session request? The parent will be notified.')) return;
    }
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
      setCounterForId(null);
      router.refresh();
      window.dispatchEvent(new Event('coach-pending-refresh'));
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoadingId(null);
    }
  };

  const submitCounter = async (requestId: string) => {
    const dateStr = counterDateById[requestId]?.trim();
    const time = counterTimeById[requestId]?.trim();
    if (!dateStr || !time) {
      window.alert('Pick a date and an open time slot for the counter-proposal.');
      return;
    }
    const slots = counterSlotsById[requestId] ?? [];
    if (slots.length > 0 && !slots.includes(time)) {
      window.alert('That time is not available. Choose a slot from the list.');
      return;
    }
    const iso = new Date(`${dateStr}T${time}:00`).toISOString();
    setLoadingId(requestId);
    try {
      const res = await fetch(`/api/parent-session-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'counter',
          counterPreferredDatetime: iso,
          counterNote: counterNoteById[requestId]?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCounterForId(null);
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
            <Link
              href="/coach-help"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#D4AF37] hover:underline whitespace-nowrap"
            >
              <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
              Coach help
            </Link>
          </div>
          <p className="text-muted-foreground text-sm md:text-base mt-1">
            {coachFirstName ? `Hey ${coachFirstName}` : 'Your sessions'} — who&apos;s booked, what&apos;s pending.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:shrink-0">
          <Button
            asChild
            className="min-h-[44px] touch-manipulation bg-[#D4AF37] hover:bg-[#c9a432] text-black font-semibold w-full sm:w-auto"
          >
            <Link href="/coach-sessions/create">
              <CalendarPlus className="h-4 w-4 mr-2 shrink-0" />
              Create session
            </Link>
          </Button>
          <Button variant="outline" asChild className="min-h-[44px] touch-manipulation w-full sm:w-auto border-[#D4AF37]/50">
            <Link href="/availability">
              <CalendarClock className="h-4 w-4 mr-2 shrink-0" />
              Update my availability
            </Link>
          </Button>
        </div>
      </div>

      {today.length > 0 && (
        <section className="space-y-3" aria-label="Today">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today — {formatEST(now, 'EEEE, MMM d')}
          </h2>
          <div className="space-y-3">
            {today.map((session) => (
              <CoachScheduleSessionCard
                key={session.id}
                session={session}
                payoutRate={payoutRate}
                coachDisplayName={coachDisplayName}
                emphasis="today"
              />
            ))}
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
              const typeLabel = sessionTypeLabel(sess?.session_type, sess?.session_mode);
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
              const dur = r.duration_minutes ?? 60;
              const when = r.preferred_datetime
                ? `${formatEST(new Date(r.preferred_datetime), 'EEE MMM d')} · ${formatEST(new Date(r.preferred_datetime), 'h:mm a')}`
                : 'Time TBD';
              const counterSlots = counterSlotsById[r.id] ?? [];
              const counterTimePick = counterTimeById[r.id];
              const counterSelectValue =
                counterTimePick && counterSlots.includes(counterTimePick) ? counterTimePick : undefined;
              return (
                <Card key={r.id} className="border-amber-500/40 bg-amber-500/5">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-medium text-foreground">{name} — session request</p>
                    <p className="text-sm text-muted-foreground">
                      {when} · {dur} min · {sessionTypeLabel(r.session_type, null)} · {facName}
                    </p>
                    {r.message ? <p className="text-sm text-muted-foreground">&ldquo;{r.message}&rdquo;</p> : null}
                    <label className="block text-xs text-muted-foreground" htmlFor={`slot-${r.id}`}>
                      Optional note to parent (approve / decline)
                    </label>
                    <textarea
                      id={`slot-${r.id}`}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={slotNoteById[r.id] ?? ''}
                      onChange={(e) => setSlotNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    />
                    {counterForId === r.id && (
                      <div className="rounded-lg border border-border bg-background/80 p-3 space-y-2">
                        <p className="text-xs font-medium text-foreground">Propose a different time</p>
                        <p className="text-xs text-muted-foreground">
                          Only times that are still open on your calendar (same rules as parent booking).
                        </p>
                        <input
                          type="date"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
                          min={formatEST(new Date(), 'yyyy-MM-dd')}
                          value={counterDateById[r.id] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCounterDateById((prev) => ({ ...prev, [r.id]: v }));
                            setCounterTimeById((prev) => ({ ...prev, [r.id]: '' }));
                          }}
                        />
                        {counterSlotsLoadingId === r.id ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading open slots…
                          </p>
                        ) : counterSlots.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No open slots this day. Choose another date.
                          </p>
                        ) : (
                          <Select
                            value={counterSelectValue}
                            onValueChange={(v) => setCounterTimeById((prev) => ({ ...prev, [r.id]: v }))}
                          >
                            <SelectTrigger className="w-full min-h-[44px]">
                              <SelectValue placeholder="Select a start time" />
                            </SelectTrigger>
                            <SelectContent>
                              {counterSlots.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {formatSlotDisplay(t)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <textarea
                          rows={2}
                          placeholder="Optional note (e.g. original slot is taken)"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={counterNoteById[r.id] ?? ''}
                          onChange={(e) => setCounterNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => void submitCounter(r.id)}
                            disabled={
                              loadingId === r.id ||
                              counterSlotsLoadingId === r.id ||
                              !counterSlots.length ||
                              !counterTimeById[r.id]
                            }
                          >
                            Send counter
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => setCounterForId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
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
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-[44px] touch-manipulation"
                        onClick={() => {
                          setCounterForId((cur) => {
                            if (cur === r.id) return null;
                            const initialDate = r.preferred_datetime
                              ? formatEST(new Date(r.preferred_datetime), 'yyyy-MM-dd')
                              : formatEST(new Date(), 'yyyy-MM-dd');
                            setCounterDateById((prev) => ({ ...prev, [r.id]: initialDate }));
                            setCounterTimeById((prev) => ({ ...prev, [r.id]: '' }));
                            return r.id;
                          });
                        }}
                        disabled={loadingId === r.id}
                      >
                        Counter
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
            {upcoming.map((session) => (
              <CoachScheduleSessionCard
                key={session.id}
                session={session}
                payoutRate={payoutRate}
                coachDisplayName={coachDisplayName}
              />
            ))}
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
