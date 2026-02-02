'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Calendar, User, MapPin, MessageCircle, X, FolderOpen } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';
import { differenceInHours } from 'date-fns';

const CANCELLATION_WINDOW_HOURS = 24;

export type BookingSession = {
  id: string;
  scheduled_datetime: string;
  status: string;
  total_price: number;
  session_type?: string;
  session_mode?: string;
  partner_invite_code?: string | null;
  coach: { name: string; school: string; id: string };
  facility: string;
  wrestlers: string[];
};

interface BookingCardProps {
  session: BookingSession;
  isPast?: boolean;
}

export function BookingCard({ session, isPast = false }: BookingCardProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const scheduledTime = new Date(session.scheduled_datetime);
  const hoursUntilSession = differenceInHours(scheduledTime, new Date());
  const canCancel = 
    !isPast && 
    (session.status === 'scheduled' || session.status === 'pending_payment') &&
    scheduledTime > new Date();
  
  const willGetCredit = hoursUntilSession >= CANCELLATION_WINDOW_HOURS && session.status === 'scheduled';

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
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="font-medium">
              {scheduledTime.toLocaleDateString('en-US', {
                weekday: isPast ? 'short' : 'long',
                year: 'numeric',
                month: isPast ? 'short' : 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {scheduledTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
              {' · '}
              <MapPin className="h-4 w-4 inline" />
              {session.facility}
            </p>
            <p className="text-sm flex items-center gap-1">
              <User className="h-4 w-4" />
              {session.coach.name}
              {session.coach.school && (
                <span className="flex items-center gap-1">
                  <SchoolLogo school={session.coach.school} size="sm" />
                  ({session.coach.school})
                </span>
              )}
            </p>
            {session.wrestlers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Wrestler(s): {session.wrestlers.join(', ')}
              </p>
            )}
            <div className="pt-2">{statusBadge(session.status)}</div>
          </div>
          <div className="text-left sm:text-right flex flex-col sm:items-end gap-2 shrink-0">
            <p className={isPast ? 'font-bold' : 'text-xl font-bold'}>
              ${Number(session.total_price).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{session.session_type ?? '—'}</p>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Link href={`/workspaces/from-session/${session.id}`} className="min-h-[44px] inline-flex">
                <Button variant="outline" size="sm" className="min-h-[44px] px-4">
                  <FolderOpen className="h-4 w-4 mr-1 shrink-0" />
                  Workspace
                </Button>
              </Link>
              <Link href={`/messages/${session.id}`} className="min-h-[44px] inline-flex">
                <Button variant="outline" size="sm" className="min-h-[44px] px-4">
                  <MessageCircle className="h-4 w-4 mr-1 shrink-0" />
                  Message
                </Button>
              </Link>
              {!isPast && (
                <Link href={`/sessions/${session.id}/reschedule`} className="min-h-[44px] inline-flex">
                  <Button variant="outline" size="sm" className="min-h-[44px] px-4">Reschedule</Button>
                </Link>
              )}
              {canCancel && !showConfirm && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowConfirm(true)}
                  className="min-h-[44px] px-4 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="h-4 w-4 mr-1 shrink-0" />
                  Cancel
                </Button>
              )}
            </div>
            
            {/* Cancel confirmation */}
            {showConfirm && (
              <div className="mt-2 p-3 border border-destructive/50 rounded-lg bg-destructive/5 text-left w-full max-w-xs">
                <p className="text-sm font-medium mb-2">Cancel this session?</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {willGetCredit 
                    ? `You'll receive a $${Number(session.total_price).toFixed(2)} credit for future bookings.`
                    : `Less than ${CANCELLATION_WINDOW_HOURS} hours notice — no credit will be issued.`
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
