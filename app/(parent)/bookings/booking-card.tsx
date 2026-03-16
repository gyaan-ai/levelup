'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Calendar, User, MapPin, X, Share2, Check, ExternalLink, RotateCcw, Star } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';
import { differenceInHours } from 'date-fns';
import { formatEST } from '@/lib/format-date';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { ProfileImage } from '@/components/profile-image';

const CANCELLATION_WINDOW_HOURS = 24;

export type BookingSession = {
  id: string;
  scheduled_datetime: string;
  status: string;
  total_price: number;
  /** Per-person price when session is pay-per-spot (e.g. small group $30). Shown when total_price is 0. */
  price_per_participant?: number;
  /** What this family actually paid (from session_participants.amount_paid). Shown when set. */
  amountPaid?: number;
  session_type?: string;
  session_mode?: string;
  /** Session focus/topic for group/small_group (e.g. "Neutral Re-Attacks"). */
  focus_area?: string | null;
  partner_invite_code?: string | null;
  /** Small group or partner-open session not yet filled (open slots). */
  isTentative?: boolean;
  /** True if current user created this session (can cancel whole session). False = participant (can leave session). */
  isOwner?: boolean;
  coach: { name: string; school: string; id: string; photo_url?: string | null };
  facility: string;
  facility_id?: string | null;
  wrestlers: string[];
  primaryWrestlerId?: string | null;
  /** True if current user already left a review for this (completed) session */
  hasReviewed?: boolean;
};

interface BookingCardProps {
  session: BookingSession;
  isPast?: boolean;
}

export function BookingCard({ session, isPast = false }: BookingCardProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyShareLink = async () => {
    if (!session.partner_invite_code) return;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${session.partner_invite_code}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  };

  const scheduledTime = new Date(session.scheduled_datetime);
  const hoursUntilSession = differenceInHours(scheduledTime, new Date());
  const canCancel = 
    !isPast && 
    (session.status === 'scheduled' || session.status === 'pending_payment') &&
    scheduledTime > new Date();
  
  const canLeave = canCancel && !session.isOwner;
  const willGetRefund = hoursUntilSession >= CANCELLATION_WINDOW_HOURS && session.status === 'scheduled';

  const handleLeaveSession = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/leave`, { method: 'POST' });
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
      const res = await fetch(`/api/sessions/${session.id}/cancel`, {
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
      router.refresh();
    } catch (e) {
      console.error('Cancel error:', e);
      alert('Failed to cancel session');
    } finally {
      setCancelling(false);
      setShowConfirm(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'scheduled') return <Badge>Scheduled</Badge>;
    if (status === 'pending_payment') return <Badge variant="secondary">Pending payment</Badge>;
    if (status === 'completed') return <Badge variant="default">Completed</Badge>;
    if (status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>;
    if (status === 'no-show') return <Badge variant="secondary">No-show</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Card className={isPast ? 'bg-muted/20' : ''}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
          <div className="flex gap-3 flex-1 min-w-0">
            <ProfileImage
              src={session.coach.photo_url}
              alt={session.coach.name}
              className="w-12 h-12 shrink-0 rounded-full object-cover border border-border"
              fallbackIconClassName="h-6 w-6 text-muted-foreground"
            />
            <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SessionTypeBadge sessionType={session.session_type} sessionMode={session.session_mode} />
              {session.focus_area && (
                <Badge variant="secondary" className="font-normal text-xs">
                  {session.focus_area}
                </Badge>
              )}
              {statusBadge(session.status)}
              {session.isTentative && (
                <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-400 bg-amber-500/15">
                  Tentative
                </Badge>
              )}
            </div>
            <p className="font-semibold text-foreground">
              {isPast
                ? formatEST(scheduledTime, 'EEE, MMM d, yyyy')
                : formatEST(scheduledTime, 'EEEE, MMM d, yyyy')}
              {' · '}
              {formatEST(scheduledTime, 'h:mm a')}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {session.facility}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <User className="h-3.5 w-3.5 shrink-0" />
              {session.coach.id ? (
                <Link href={`/athlete/${session.coach.id}`} className="hover:underline text-foreground font-medium">
                  {session.coach.name}
                </Link>
              ) : (
                session.coach.name
              )}
              {session.coach.school && (
                <span className="flex items-center gap-1">
                  <SchoolLogo school={session.coach.school} size="sm" />
                  <span className="text-muted-foreground/80">({session.coach.school})</span>
                </span>
              )}
              {session.coach.id && (
                <Link href={`/athlete/${session.coach.id}`} className="text-xs text-accent hover:underline">
                  View profile
                </Link>
              )}
            </p>
            {session.wrestlers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {session.wrestlers.join(', ')}
              </p>
            )}
            </div>
          </div>
          <div className="text-left sm:text-right flex flex-col sm:items-end gap-2 shrink-0">
            <p className={isPast ? 'font-bold' : 'text-xl font-bold'}>
              {session.amountPaid != null && session.amountPaid > 0
                ? `You paid $${Number(session.amountPaid).toFixed(2)}`
                : session.total_price > 0
                  ? `$${Number(session.total_price).toFixed(2)}`
                  : session.price_per_participant != null && session.price_per_participant > 0
                    ? `$${Number(session.price_per_participant).toFixed(2)} /person`
                    : `$${Number(session.total_price).toFixed(2)}`}
            </p>
            <div className="flex flex-col gap-2 sm:items-end">
              {!isPast && (
                <Link href={`/sessions/${session.id}/reschedule`} className="inline-flex">
                  <Button size="sm" className="min-h-[44px] px-4">
                    <ExternalLink className="h-4 w-4 mr-1 shrink-0" />
                    View
                  </Button>
                </Link>
              )}
              {!isPast && (
                <div className="flex flex-wrap gap-2">
                  {session.isOwner && (
                    <Link href={`/sessions/${session.id}/reschedule`}>
                      <Button variant="outline" size="sm" className="min-h-[40px] px-3">Reschedule</Button>
                    </Link>
                  )}
                  {session.isOwner && canCancel && !showConfirm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConfirm(true)}
                      className="min-h-[40px] px-3 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Cancel
                    </Button>
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
                </div>
              )}
              {isPast && session.status === 'completed' && !session.hasReviewed && (
                <Link href={`/sessions/${session.id}/review`} className="inline-flex">
                  <Button size="sm" className="min-h-[40px] px-3 bg-accent hover:bg-accent/90 text-primary">
                    <Star className="h-4 w-4 mr-1 shrink-0 fill-current" />
                    Leave feedback
                  </Button>
                </Link>
              )}
              {isPast && session.coach.id && (
                <Link
                  href={
                    `/training?tab=sessions&coach=${session.coach.id}` +
                    (session.facility_id ? `&location=${session.facility_id}` : '') +
                    (session.primaryWrestlerId ? `&wrestler=${session.primaryWrestlerId}` : '')
                  }
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm" className="min-h-[40px] px-3">
                    <RotateCcw className="h-4 w-4 mr-1 shrink-0" />
                    Book again
                  </Button>
                </Link>
              )}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {session.partner_invite_code && !isPast && (
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="hover:text-foreground underline"
                    title="Copy invite link"
                  >
                    {linkCopied ? 'Copied!' : 'Share link'}
                  </button>
                )}
              </div>
            </div>
            
            {/* Cancel whole session (owner only) */}
            {showConfirm && (
              <div className="mt-2 p-3 border border-destructive/50 rounded-lg bg-destructive/5 text-left w-full max-w-xs">
                <p className="text-sm font-medium mb-2">Cancel this session?</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {willGetRefund
                    ? `A refund of $${Number(session.total_price).toFixed(2)} will be processed (24h+ notice).`
                    : `Less than ${CANCELLATION_WINDOW_HOURS} hours notice — no refund.`
                  }
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                    disabled={cancelling}
                  >
                    Keep session
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                  </Button>
                </div>
              </div>
            )}
            {/* Leave session (participant: free up my spot) */}
            {showLeaveConfirm && (
              <div className="mt-2 p-3 border border-destructive/50 rounded-lg bg-destructive/5 text-left w-full max-w-xs">
                <p className="text-sm font-medium mb-2">Leave this session?</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Your spot will open back up for someone else. You won’t be charged further.
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowLeaveConfirm(false)}
                    disabled={leaving}
                  >
                    Keep my spot
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={handleLeaveSession}
                    disabled={leaving}
                  >
                    {leaving ? 'Leaving…' : 'Yes, leave'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
