'use client';

import { getSessionTypeDisplay } from '@/lib/session-type-display';

interface SessionTypeBadgeProps {
  sessionType?: string | null;
  sessionMode?: string | null;
}

export function SessionTypeBadge({ sessionType, sessionMode }: SessionTypeBadgeProps) {
  const { label, className } = getSessionTypeDisplay(sessionType, sessionMode);
  return <span className={className}>{label}</span>;
}
