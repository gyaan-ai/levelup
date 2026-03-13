'use client';

import { Button } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';
import { buildSessionICS, downloadICS } from '@/lib/calendar-utils';

type Props = {
  sessionId: string;
  title: string;
  start: string; // ISO datetime
  end?: string; // ISO datetime, optional
  location?: string;
  description?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary' | 'premium';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
};

const DEFAULT_DURATION_MINUTES = 60;

export function AddToCalendarButton({
  sessionId,
  title,
  start,
  end,
  location,
  description,
  variant = 'outline',
  size = 'sm',
  className,
}: Props) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);

  const handleClick = () => {
    const ics = buildSessionICS({
      id: sessionId,
      title,
      start: startDate,
      end: endDate,
      location,
      description,
    });
    const safeTitle = title.replace(/[^a-z0-9]/gi, '-').slice(0, 40);
    downloadICS(ics, `${safeTitle || 'session'}.ics`);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      aria-label="Add to calendar"
    >
      <CalendarPlus className="h-4 w-4 mr-1 shrink-0" />
      Add to calendar
    </Button>
  );
}
