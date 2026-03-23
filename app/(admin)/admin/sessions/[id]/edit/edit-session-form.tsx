'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SESSION_FOCUS_AREAS } from '@/lib/focus-areas';
import { formatEST } from '@/lib/format-date';
import { coachPayoutUsd } from '@/lib/coach-session-payout';
import { Loader2, Trash2 } from 'lucide-react';

type Props = {
  sessionId: string;
  sessionStatus?: string;
  sessionType?: string;
  focusArea: string;
  focusArea2?: string;
  joinPolicy: 'public' | 'private' | 'invite_only';
  maxParticipants: number;
  pricePerParticipant: number;
  currentParticipants: number;
  scheduledDate: string;
  scheduledTime: string;
  /** Gross coach payout for this session (from bookings), if any */
  athletePayment?: number | null;
  /** YYYY-MM-DD when payout was marked paid */
  athletePayoutDate?: string | null;
};

export function EditSessionForm({
  sessionId,
  sessionStatus,
  sessionType,
  focusArea,
  focusArea2 = '',
  joinPolicy,
  maxParticipants,
  pricePerParticipant,
  currentParticipants,
  scheduledDate: initialDate,
  scheduledTime: initialTime,
  athletePayment = null,
  athletePayoutDate = null,
}: Props) {
  const router = useRouter();
  const [focus, setFocus] = useState(focusArea);
  const [focus2, setFocus2] = useState(focusArea2);
  const [join, setJoin] = useState(joinPolicy);
  const [max, setMax] = useState(String(maxParticipants));
  const [price, setPrice] = useState(String(pricePerParticipant));
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusAreaList, setFocusAreaList] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);

  function suggestedCoachPayoutAmount(): string {
    return String(
      coachPayoutUsd({
        athlete_payment: athletePayment,
        price_per_participant: pricePerParticipant,
        current_participants: currentParticipants,
      })
    );
  }

  const [payoutAmount, setPayoutAmount] = useState(() => {
    if (athletePayoutDate || sessionStatus !== 'completed') return '';
    return suggestedCoachPayoutAmount();
  });

  const wasCompletedOnMount = useRef(sessionStatus === 'completed');
  useEffect(() => {
    const nowCompleted = sessionStatus === 'completed';
    if (nowCompleted && !wasCompletedOnMount.current && !athletePayoutDate) {
      setPayoutAmount(suggestedCoachPayoutAmount());
    }
    wasCompletedOnMount.current = nowCompleted;
  }, [sessionStatus, athletePayoutDate, athletePayment, pricePerParticipant, currentParticipants]);

  useEffect(() => {
    fetch('/api/focus-areas')
      .then((r) => r.json())
      .then((data) => data.focusAreas && data.focusAreas.length > 0 && setFocusAreaList(data.focusAreas))
      .catch(() => {});
  }, []);

  const focusOptions = focusAreaList.length > 0 ? focusAreaList : [...SESSION_FOCUS_AREAS];
  const optionsWithCurrent = focus && !focusOptions.includes(focus) ? [focus, ...focusOptions] : focusOptions;

  const isGroup = sessionType === 'group' || sessionType === 'small_group';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus_area: focus.trim() || null,
          focus_area_2: focus2.trim() || null,
          join_policy: join,
          max_participants: Math.min(20, Math.max(1, parseInt(max, 10) || 2)),
          price_per_participant: Math.max(0, parseFloat(price) || 0),
          scheduledDate: date,
          scheduledTime: time,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update session');
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Session details</CardTitle>
        <CardDescription>
          Update date/time (Eastern), topic, who can join, max spots, and price. Only scheduled or pending-payment sessions can be edited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-time">Time (Eastern)</Label>
              <Input
                id="edit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>
          {isGroup && (
            <>
              <div>
                <Label htmlFor="focus">Topic / focus (1)</Label>
                <Select value={focus || 'none'} onValueChange={(v) => setFocus(v === 'none' ? '' : v)}>
                  <SelectTrigger id="focus">
                    <SelectValue placeholder="e.g. Takedowns, Escapes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {optionsWithCurrent.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="focus2">Topic / focus (2) — optional</Label>
                <Select value={focus2 || 'none'} onValueChange={(v) => setFocus2(v === 'none' ? '' : v)}>
                  <SelectTrigger id="focus2">
                    <SelectValue placeholder="Second topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(focus2 && !focusOptions.includes(focus2)
                      ? [focus2, ...focusOptions]
                      : focusOptions
                    )
                      .filter((a) => a !== focus)
                      .map((area) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Shown on session cards as &quot;Covering: …&quot;
                </p>
              </div>
              <div>
                <Label htmlFor="join">Who can join</Label>
                <Select value={join} onValueChange={(v) => setJoin(v as Props['joinPolicy'])}>
                  <SelectTrigger id="join">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — listed on Training; anyone can join</SelectItem>
                    <SelectItem value="private">Private — not listed; only you add wrestlers</SelectItem>
                    <SelectItem value="invite_only">Invite only — not listed; share link to register</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max">Max participants</Label>
                  <Input
                    id="max"
                    type="number"
                    min={1}
                    max={20}
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Currently {currentParticipants} registered
                  </p>
                </div>
                <div>
                  <Label htmlFor="price">Price per participant ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={5}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
          {!isGroup && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max-other">Max participants</Label>
                <Input
                  id="max-other"
                  type="number"
                  min={1}
                  max={20}
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="price-other">Price per participant ($)</Label>
                <Input
                  id="price-other"
                  type="number"
                  min={0}
                  step={5}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
            {(sessionStatus === 'scheduled' || sessionStatus === 'pending_payment') && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete session
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>

    {(sessionStatus === 'scheduled' || sessionStatus === 'pending_payment') && (
      <Card>
        <CardHeader>
          <CardTitle>1 · Mark session complete</CardTitle>
          <CardDescription>
            Do this first: record that this session happened. Status becomes completed so it counts in coach stats and unlocks payout below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="default"
            disabled={completeLoading}
            onClick={async () => {
              setCompleteLoading(true);
              setError(null);
              try {
                const res = await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
                const data = await res.json();
                if (res.ok && data.success) {
                  router.refresh();
                } else {
                  setError(data.error || 'Failed to mark complete');
                }
              } catch {
                setError('Failed to mark complete');
              } finally {
                setCompleteLoading(false);
              }
            }}
          >
            {completeLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Marking…
              </>
            ) : (
              'Mark as completed'
            )}
          </Button>
        </CardContent>
      </Card>
    )}

    <Card className={sessionStatus !== 'completed' ? 'opacity-90' : undefined}>
      <CardHeader>
        <CardTitle>2 · Record coach payout</CardTitle>
        <CardDescription>
          {athletePayoutDate ? (
            <>This session is already marked paid.</>
          ) : sessionStatus !== 'completed' ? (
            <>After the session is marked complete (step 1), enter what you paid the coach and record it here. Use a custom amount when parents didn&apos;t pay but you still pay the coach (e.g. flat $50).</>
          ) : (
            <>
              Sets <span className="font-medium">athlete payment</span> and today&apos;s payout date for this session. Adjust the amount if needed (e.g. cash comp or different split).
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {athletePayoutDate ? (
          <p className="text-sm text-muted-foreground">
            Payout recorded on{' '}
            <span className="font-medium text-foreground">
              {formatEST(`${athletePayoutDate}T12:00:00`, 'MMM d, yyyy')}
            </span>
            {athletePayment != null && Number(athletePayment) > 0 && (
              <> · ${Number(athletePayment).toFixed(2)}</>
            )}
          </p>
        ) : sessionStatus !== 'completed' ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
            Complete step 1 first — payout can only be recorded for completed sessions.
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const val = parseFloat(payoutAmount);
              if (Number.isNaN(val) || val < 0) return;
              setPayoutLoading(true);
              setError(null);
              try {
                const res = await fetch('/api/admin/record-session-payout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionIds: [sessionId], amount: val }),
                });
                const data = await res.json();
                if (res.ok && data.success) {
                  router.refresh();
                  setPayoutAmount('');
                } else {
                  setError(data.error || 'Failed to record payout');
                }
              } catch {
                setError('Failed to record payout');
              } finally {
                setPayoutLoading(false);
              }
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="payout-amount" className="whitespace-nowrap">
                Coach payout ($)
              </Label>
              <Input
                id="payout-amount"
                type="number"
                min={0}
                step={5}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="w-28"
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground max-w-sm">
                Suggested from recorded payout or roster (price × {currentParticipants} × coach share) — edit for cash, comps, or off-app payments.
              </p>
            </div>
            <Button type="submit" disabled={payoutLoading || payoutAmount.trim() === ''}>
              {payoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Recording…
                </>
              ) : (
                'Record payout'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>

    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete session?</DialogTitle>
          <DialogDescription>
            This will permanently delete this session and all participants. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setDeleteLoading(true);
              try {
                const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) {
                  setError(data.error || 'Failed to delete session');
                  setShowDeleteConfirm(false);
                  return;
                }
                router.push('/admin');
                router.refresh();
              } catch {
                setError('Failed to delete session');
                setShowDeleteConfirm(false);
              } finally {
                setDeleteLoading(false);
              }
            }}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
