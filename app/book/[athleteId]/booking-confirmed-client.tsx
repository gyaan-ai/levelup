'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Copy, Check, Share2, Mail } from 'lucide-react';
import { add, format } from 'date-fns';

interface BookingConfirmedClientProps {
  joinUrl: string;
  dateTime: string;
  facilityName?: string;
  athleteName: string;
  scheduledAt: string;
}

export function BookingConfirmedClient({
  joinUrl,
  dateTime,
  facilityName,
  athleteName,
  scheduledAt,
}: BookingConfirmedClientProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const sessionDate = scheduledAt ? new Date(scheduledAt) : null;
  const deadline24h = sessionDate ? add(sessionDate, { hours: -24 }) : null;
  const deadlineStr = deadline24h ? format(deadline24h, 'MMMM d, h:mm a') : '24 hours before the session';

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Your session is pending a partner. Share the link below so someone can join and pay $40.
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium">Shareable link</p>
        <div className="flex gap-2">
          <Input readOnly value={joinUrl} className="font-mono text-sm" />
          <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Join my wrestling session with ${athleteName} - ${dateTime}\n${joinUrl}`)}`} target="_blank" rel="noopener noreferrer">
            <Share2 className="h-4 w-4 mr-2" />
            Share via Text
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`mailto:?subject=Join my wrestling session&body=${encodeURIComponent(`Join my wrestling session with ${athleteName}\n\n${dateTime}\n${facilityName ? `Location: ${facilityName}\n` : ''}\nJoin here: ${joinUrl}`)}`}>
            <Mail className="h-4 w-4 mr-2" />
            Share via Email
          </a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        If no partner joins by {deadlineStr}, we&apos;ll email you options.
      </p>
      <Button asChild>
        <Link href="/dashboard">View My Sessions</Link>
      </Button>
    </div>
  );
}
