'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, Trash2 } from 'lucide-react';

type Props = {
  sessionId: string;
  sessionStatus?: string;
  sessionType?: string;
  focusArea: string;
  joinPolicy: 'public' | 'private' | 'invite_only';
  maxParticipants: number;
  pricePerParticipant: number;
  currentParticipants: number;
  scheduledDate: string;
  scheduledTime: string;
};

export function EditSessionForm({
  sessionId,
  sessionStatus,
  sessionType,
  focusArea,
  joinPolicy,
  maxParticipants,
  pricePerParticipant,
  currentParticipants,
  scheduledDate: initialDate,
  scheduledTime: initialTime,
}: Props) {
  const router = useRouter();
  const [focus, setFocus] = useState(focusArea);
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
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);

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
                <Label htmlFor="focus">Topic / focus</Label>
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
                    <SelectItem value="public">Public — anyone can discover and pay</SelectItem>
                    <SelectItem value="private">Private — no one else</SelectItem>
                    <SelectItem value="invite_only">Invite only — need link, then pay</SelectItem>
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
          <CardTitle>Mark session complete</CardTitle>
          <CardDescription>
            Record that this session happened. This updates the session status to completed and will show in coach stats and payouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="default"
            disabled={completeLoading}
            onClick={async () => {
              setCompleteLoading(true);
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

    <Card>
      <CardHeader>
        <CardTitle>Record coach payout</CardTitle>
        <CardDescription>
          When parents don&apos;t pay but you still pay the coach (e.g. flat $50), record the amount and mark paid for this session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const val = parseFloat(payoutAmount);
            if (Number.isNaN(val) || val < 0) return;
            setPayoutLoading(true);
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
          <div className="flex items-center gap-2">
            <Label htmlFor="payout-amount" className="whitespace-nowrap">Amount ($)</Label>
            <Input
              id="payout-amount"
              type="number"
              min={0}
              step={5}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="w-24"
              placeholder="50"
            />
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
