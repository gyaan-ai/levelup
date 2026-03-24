'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { differenceInHours } from 'date-fns';
import { Button } from '@/components/ui/button';
import { RotateCcw, Star } from 'lucide-react';

const CANCELLATION_WINDOW_HOURS = 24;

interface SessionDetailActionsProps {
  sessionId: string;
  isPast: boolean;
  isOwner: boolean;
  canLeave: boolean;
  canCancel: boolean;
  scheduledDatetime: string;
  totalPrice: number;
  status: string;
  hasReviewed?: boolean;
}

export function SessionDetailActions({
  sessionId,
  isPast,
  isOwner,
  canLeave,
  canCancel,
  scheduledDatetime,
  totalPrice,
  status,
  hasReviewed,
}: SessionDetailActionsProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const scheduledTime = new Date(scheduledDatetime);
  const hoursUntilSession = differenceInHours(scheduledTime, new Date());
  const willGetRefund = hoursUntilSession >= CANCELLATION_WINDOW_HOURS && status === 'scheduled';

  const handleLeave = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/leave`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to leave session');
        return;
      }
      alert(data.message);
      setShowLeaveConfirm(false);
      router.refresh();
    } catch (e) {
      console.error('Leave error:', e);
      alert('Failed to leave session');
    } finally {
      setLeaving(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by parent' }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to cancel session');
        return;
      }
      alert(data.message);
      setShowCancelConfirm(false);
      router.refresh();
    } catch (e) {
      console.error('Cancel error:', e);
      alert('Failed to cancel session');
    } finally {
      setCancelling(false);
    }
  };

  if (isPast) {
    // Only show Leave feedback button if session is completed and not yet reviewed
    if (status === 'completed' && !hasReviewed) {
      return (
        <Link href={`/sessions/${sessionId}/review`} className="inline-flex">
          <Button className="min-h-[44px] px-4 bg-accent hover:bg-accent/90 text-primary">
            <Star className="h-4 w-4 mr-1 shrink-0 fill-current" />
            Leave feedback
          </Button>
        </Link>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {isOwner && (
        <Link href={`/sessions/${sessionId}/reschedule`} className="inline-flex">
          <Button size="sm" className="min-h-[44px] px-4">
            <RotateCcw className="h-4 w-4 mr-1 shrink-0" />
            Reschedule
          </Button>
        </Link>
      )}
      {canLeave && !showLeaveConfirm && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLeaveConfirm(true)}
          className="min-h-[40px] px-3 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          Leave session
        </Button>
      )}
      {canCancel && !showCancelConfirm && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelConfirm(true)}
          className="min-h-[40px] px-3 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          Cancel session
        </Button>
      )}
      {showLeaveConfirm && (
        <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/5 text-left">
          <p className="text-sm font-medium mb-2">Leave this session?</p>
          <p className="text-xs text-muted-foreground mb-3">
            Your spot will open back up for someone else. You won’t be charged further.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowLeaveConfirm(false)} disabled={leaving}>
              Keep my spot
            </Button>
            <Button size="sm" variant="destructive" onClick={handleLeave} disabled={leaving}>
              {leaving ? 'Leaving…' : 'Yes, leave'}
            </Button>
          </div>
        </div>
      )}
      {showCancelConfirm && (
        <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/5 text-left">
          <p className="text-sm font-medium mb-2">Cancel this session?</p>
          <p className="text-xs text-muted-foreground mb-3">
            {willGetRefund
              ? `A refund of $${Number(totalPrice).toFixed(2)} will be processed (24h+ notice).`
              : `Less than ${CANCELLATION_WINDOW_HOURS} hours notice — no refund.`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCancelConfirm(false)} disabled={cancelling}>
              Keep session
            </Button>
            <Button size="sm" variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Yes, cancel'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
