'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, DollarSign, Smartphone, Trash2, Loader2, Share2, ExternalLink, CalendarPlus, Pencil } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { CoachTextGroupDialog } from '@/components/coach-text-group-dialog';
import { CopySessionPhonesButton } from '@/components/copy-session-phones-button';
import { formatEST } from '@/lib/format-date';
import { coachPayoutUsd } from '@/lib/coach-session-payout';
import { COACH_REVENUE_FRACTION } from '@/lib/pricing';
import { showSessionSmsCopyAndTextGroup } from '@/lib/session-sms-tools';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { CapacityBadge } from '@/components/capacity-badge';
import { SessionContactsPanel } from '@/components/session-contacts-panel';
import type { CoachSession } from '@/app/(athlete)/athlete-dashboard/coach-schedule-card';

function facilityName(s: CoachSession): string {
  const f = s.facilities;
  if (!f || typeof f !== 'object') return '—';
  const arr = Array.isArray(f) ? f : [f];
  const first = arr[0] as { name?: string } | null;
  return first?.name ?? '—';
}

function participantPaidSum(s: CoachSession): number {
  const parts = s.session_participants;
  if (!Array.isArray(parts)) return 0;
  return parts.reduce(
    (sum, p) => sum + Number((p as { amount_paid?: number | null }).amount_paid ?? 0),
    0
  );
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

type Tab = 'mine' | 'requests' | 'completed' | 'all';

type RequestItem = {
  id: string;
  session_id: string;
  message?: string;
  status: string;
  created_at: string;
  youth_wrestler_id: string;
  youth_wrestlers?: { id: string; first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string } | null;
  session?: { id: string; scheduled_datetime: string; session_type?: string; session_mode?: string; facilities?: { name?: string } | null };
};

export type SlotRequestItem = {
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
  youth_wrestlers?: { id: string; first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string } | null;
  facilities?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
};

export type CommunitySession = {
  id: string;
  scheduled_datetime: string;
  session_type?: string | null;
  session_mode?: string | null;
  current_participants?: number | null;
  max_participants?: number | null;
  price_per_participant?: number | null;
  athletes?:
    | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string | null }
    | Array<{ id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string | null }>
    | null;
  facilities?:
    | { id?: string; name?: string }
    | Array<{ id?: string; name?: string }>
    | null;
};

function communityFacilityName(s: CommunitySession): string {
  const f = s.facilities;
  if (!f || typeof f !== 'object') return '—';
  const arr = Array.isArray(f) ? f : [f];
  return (arr[0] as { name?: string })?.name ?? '—';
}

function communityCoachName(s: CommunitySession): string {
  const a = s.athletes;
  const o = a ? (Array.isArray(a) ? a[0] : a) : null;
  return o ? [o.first_name, o.last_name].filter(Boolean).join(' ').trim() || 'Coach' : 'Coach';
}

function communityCoachSchool(s: CommunitySession): string | null {
  const a = s.athletes;
  const o = a ? (Array.isArray(a) ? a[0] : a) : null;
  const sch = o?.school;
  return sch && String(sch).trim() ? String(sch).trim() : null;
}

type Props = {
  initialTab: Tab;
  upcomingSessions: CoachSession[];
  completedSessions: CoachSession[];
  pendingRequests: RequestItem[];
  /** Other coaches’ public / invite-only upcoming sessions */
  communitySessions: CommunitySession[];
  /** Parents asking for a time / format before a session exists */
  pendingSlotRequests: SlotRequestItem[];
  payoutRate?: number;
};

export function CoachSessionsClient({
  initialTab,
  upcomingSessions,
  completedSessions,
  pendingRequests,
  pendingSlotRequests,
  communitySessions,
  payoutRate = COACH_REVENUE_FRACTION,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(initialTab);

  const goTab = (id: Tab) => {
    setTab(id);
    if (id === 'mine') {
      router.replace(pathname, { scroll: false });
      return;
    }
    const params = new URLSearchParams();
    if (id === 'requests') params.set('tab', 'requests');
    else if (id === 'completed') params.set('tab', 'past');
    else if (id === 'all') params.set('tab', 'all');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>(pendingRequests);
  const [slotRequests, setSlotRequests] = useState<SlotRequestItem[]>(pendingSlotRequests);
  const [slotNoteById, setSlotNoteById] = useState<Record<string, string>>({});
  const [textGroupSession, setTextGroupSession] = useState<CoachSession | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = async (sessionId: string) => {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCancelSession = async (sessionId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this session? All registered participants will receive a credit for their payment.'
    );
    if (!confirmed) return;

    setCancellingId(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by coach' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel session');
      alert(data.message || 'Session cancelled');
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to cancel session');
    } finally {
      setCancellingId(null);
    }
  };

  const requestCount = requests.length + slotRequests.length;

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
      setSlotRequests((prev) => prev.filter((r) => r.id !== requestId));
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoadingId(null);
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
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoadingId(null);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'mine', label: 'Mine' },
    { id: 'requests', label: `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` },
    { id: 'completed', label: 'Past' },
    { id: 'all', label: 'All' },
  ];

  return (
    <>
      {textGroupSession && (
        <CoachTextGroupDialog
          sessionId={textGroupSession.id}
          open={!!textGroupSession}
          onOpenChange={(open) => {
            if (!open) setTextGroupSession(null);
          }}
          sessionLabel={`${formatEST(new Date(textGroupSession.scheduled_datetime), 'EEE, MMM d · h:mm a')} · ${facilityName(textGroupSession)}`}
          onSent={() => router.refresh()}
        />
      )}
      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => goTab(t.id)}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium border-b-2 shrink-0 touch-manipulation ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <div className="space-y-3">
          {upcomingSessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm space-y-3">
                <p>No upcoming sessions.</p>
                <p>
                  <Link href="/availability" className="text-accent font-medium underline">Set your availability</Link>
                  {' '}so parents can book, or{' '}
                  <Link href="/coach-sessions/create" className="text-accent font-medium underline">
                    create a session
                  </Link>
                  {' '}with a share link.
                </p>
              </CardContent>
            </Card>
          ) : (
            upcomingSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <SessionTypeBadge sessionType={session.session_type} sessionMode={session.session_mode} />
                      </div>
                      <p className="font-medium">
                        {formatEST(new Date(session.scheduled_datetime), 'EEE, MMM d')} · {formatEST(new Date(session.scheduled_datetime), 'h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                        <span>{facilityName(session)}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <CapacityBadge
                            current={session.current_participants ?? 0}
                            max={session.max_participants ?? 1}
                            label=""
                          />
                          {wrestlerNames(session).length > 0 && ` ${wrestlerNames(session).join(', ')}`}
                        </span>
                      </p>
                      <p className="text-sm font-medium text-accent mt-1 inline-flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        You make $
                        {coachPayoutUsd({
                          athlete_payment: session.athlete_payment,
                          price_per_participant: session.price_per_participant,
                          current_participants: session.current_participants,
                          participant_amount_paid_sum: participantPaidSum(session) > 0 ? participantPaidSum(session) : null,
                          session_payout_rate: session.session_payout_rate ?? null,
                          coach_payout_rate: payoutRate,
                        }).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                      <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" asChild>
                        <Link href={`/coach-sessions/${session.id}/edit`}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Link>
                      </Button>
                      {showSessionSmsCopyAndTextGroup(session) && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] touch-manipulation border-accent/50 text-accent"
                            onClick={() => setTextGroupSession(session)}
                          >
                            <Smartphone className="h-4 w-4 mr-1" />
                            Text group
                          </Button>
                          <CopySessionPhonesButton
                            sessionId={session.id}
                            className="min-h-[44px] touch-manipulation"
                          />
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] touch-manipulation text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleCancelSession(session.id)}
                        disabled={cancellingId === session.id}
                      >
                        {cancellingId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Cancel
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Expandable contact info */}
                  <SessionContactsPanel
                    sessionId={session.id}
                    participantCount={session.current_participants ?? 0}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Join requests</h2>
            <p className="text-xs text-muted-foreground">
              Parents asking to join an existing session you already scheduled (partner / small group).
            </p>
            {requests.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  No pending join requests.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
            {requests.map((r) => {
              const yw = r.youth_wrestlers;
              const name = yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ') : 'A wrestler';
              const sess = r.session;
              const sessionDate = sess?.scheduled_datetime ? formatEST(new Date(sess.scheduled_datetime), 'EEE, MMM d · h:mm a') : '—';
              const fac = sess?.facilities;
              const facName = fac
                ? (Array.isArray(fac) ? (fac[0] as { name?: string })?.name : (fac as { name?: string })?.name) ?? '—'
                : '—';
              return (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="font-medium">{name}</p>
                        <p className="text-sm text-muted-foreground">{sessionDate} · {facName}</p>
                        {r.message && <p className="text-sm text-muted-foreground mt-1">&ldquo;{r.message}&rdquo;</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="min-h-[44px] touch-manipulation"
                          onClick={() => handleApproveDecline(r.id, r.session_id, 'approve')}
                          disabled={loadingId === r.id}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] touch-manipulation text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleApproveDecline(r.id, r.session_id, 'decline')}
                          disabled={loadingId === r.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Session requests</h2>
            <p className="text-xs text-muted-foreground">
              Parents asking you to offer a time or format. Approve to let them know you can work with it, or decline with a short note.
            </p>
            {slotRequests.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  No pending session requests.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {slotRequests.map((r) => {
                  const ywRaw = r.youth_wrestlers;
                  const yw = Array.isArray(ywRaw) ? ywRaw[0] : ywRaw;
                  const name = yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ') : 'A wrestler';
                  const fac = r.facilities;
                  const facName = fac
                    ? (Array.isArray(fac) ? (fac[0] as { name?: string })?.name : (fac as { name?: string })?.name) ?? '—'
                    : '—';
                  const when = r.preferred_datetime
                    ? formatEST(new Date(r.preferred_datetime), 'EEE, MMM d · h:mm a')
                    : '— (see message)';
                  const typeLabel = r.session_type ? r.session_type.replace('_', ' ') : '—';
                  return (
                    <Card key={r.id}>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">
                            {when} · {facName !== '—' ? facName : 'Facility not specified'}
                          </p>
                          <p className="text-sm text-muted-foreground">Type: {typeLabel}</p>
                          {r.message && <p className="text-sm text-muted-foreground mt-1">&ldquo;{r.message}&rdquo;</p>}
                          {r.flexibility_note && (
                            <p className="text-sm text-muted-foreground mt-1">Flexible: {r.flexibility_note}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label htmlFor={`slot-note-${r.id}`} className="text-xs text-muted-foreground">
                            Optional note to parent (included in their notification)
                          </label>
                          <Textarea
                            id={`slot-note-${r.id}`}
                            rows={2}
                            className="resize-y min-h-[72px] text-sm"
                            placeholder="e.g. I can do Tuesday 4pm — book from my profile, or I will add a slot."
                            value={slotNoteById[r.id] ?? ''}
                            onChange={(e) =>
                              setSlotNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="min-h-[44px] touch-manipulation"
                            onClick={() => handleSlotRespond(r.id, 'approve')}
                            disabled={loadingId === r.id}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] touch-manipulation text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleSlotRespond(r.id, 'decline')}
                            disabled={loadingId === r.id}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                          <Button variant="ghost" size="sm" className="min-h-[44px] touch-manipulation" asChild>
                            <Link href="/coach-sessions/create">
                              <CalendarPlus className="h-4 w-4 mr-1" />
                              New session
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'completed' && (
        <div className="space-y-3">
          {completedSessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No completed sessions yet.
              </CardContent>
            </Card>
          ) : (
            completedSessions.map((session) => (
              <Card key={session.id} className="opacity-90">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-muted-foreground">
                        {formatEST(new Date(session.scheduled_datetime), 'EEE, MMM d')} · {formatEST(new Date(session.scheduled_datetime), 'h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {facilityName(session)}
                        {wrestlerNames(session).length > 0 && ` · ${wrestlerNames(session).join(', ')}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'all' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Open sessions other coaches are hosting (public or invite link). Yours are under <span className="font-medium text-foreground">Mine</span>.
          </p>
          {communitySessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No other open sessions listed right now.
              </CardContent>
            </Card>
          ) : (
            communitySessions.map((session) => (
              <Card key={session.id} className="border-border/80">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SessionTypeBadge sessionType={session.session_type} sessionMode={session.session_mode} />
                      </div>
                      <p className="font-medium text-foreground">
                        {communityCoachName(session)}
                        {communityCoachSchool(session) ? (
                          <span className="text-muted-foreground font-normal"> · {communityCoachSchool(session)}</span>
                        ) : null}
                      </p>
                      <p className="text-sm">
                        {formatEST(new Date(session.scheduled_datetime), 'EEE, MMM d')} · {formatEST(new Date(session.scheduled_datetime), 'h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground">{communityFacilityName(session)}</p>
                      <p className="text-sm text-muted-foreground">
                        <CapacityBadge
                          current={session.current_participants ?? 0}
                          max={session.max_participants ?? 1}
                          label="spots"
                        />
                        {session.price_per_participant != null && Number(session.price_per_participant) > 0 && (
                          <span className="ml-2">${Number(session.price_per_participant).toFixed(0)}/person</span>
                        )}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="min-h-[44px] shrink-0 touch-manipulation" asChild>
                      <Link href={`/sessions/${session.id}`} prefetch={false}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </>
  );
}
