'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, FolderOpen, Check, X, DollarSign, Users, Smartphone } from 'lucide-react';
import { CoachTextGroupDialog } from '@/components/coach-text-group-dialog';
import { CopySessionPhonesButton } from '@/components/copy-session-phones-button';
import { formatEST } from '@/lib/format-date';
import { coachPayoutUsd } from '@/lib/coach-session-payout';
import { showSessionSmsCopyAndTextGroup } from '@/lib/session-sms-tools';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { CapacityBadge } from '@/components/capacity-badge';
import type { CoachSession } from '@/app/(athlete)/athlete-dashboard/coach-schedule-card';

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

type Tab = 'upcoming' | 'requests' | 'completed';

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

type Props = {
  initialTab: Tab;
  upcomingSessions: CoachSession[];
  completedSessions: CoachSession[];
  pendingRequests: RequestItem[];
};

export function CoachSessionsClient({
  initialTab,
  upcomingSessions,
  completedSessions,
  pendingRequests,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>(pendingRequests);
  const [textGroupSession, setTextGroupSession] = useState<CoachSession | null>(null);

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
    { id: 'upcoming', label: 'Open' },
    { id: 'requests', label: `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` },
    { id: 'completed', label: 'Past' },
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
            onClick={() => setTab(t.id)}
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

      {tab === 'upcoming' && (
        <div className="space-y-3">
          {upcomingSessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm space-y-3">
                <p>No upcoming sessions.</p>
                <p>
                  <Link href="/availability" className="text-accent font-medium underline">Set your schedule</Link>
                  {' '}so parents can book. New group session? Ask your admin to create one.
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
                        You make ${coachPayoutUsd(session).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                      <Link href={`/workspaces/from-session/${session.id}`}>
                        <Button variant="ghost" size="sm" className="min-h-[44px] touch-manipulation">
                          <FolderOpen className="h-4 w-4 mr-1" />
                          Workspace
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No pending join requests.
              </CardContent>
            </Card>
          ) : (
            requests.map((r) => {
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
            })
          )}
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
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/messages/${session.id}`}>
                        <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                      </Link>
                      <Link href={`/workspaces/from-session/${session.id}`}>
                        <Button variant="ghost" size="sm" className="min-h-[44px] touch-manipulation">
                          <FolderOpen className="h-4 w-4 mr-1" />
                          Workspace
                        </Button>
                      </Link>
                    </div>
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
