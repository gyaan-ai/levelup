'use client';

import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSessionBadge } from '@/lib/badges';

/** Session badge for coaches and youth athletes. Completed sessions only. Tiers: New, 10, 25, 50, 100. */
interface CoachSessionBadgeProps {
  totalSessions: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CoachSessionBadge({ totalSessions, className, size = 'md' }: CoachSessionBadgeProps) {
  const { label } = getSessionBadge(totalSessions);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-2',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center bg-accent text-black rounded-full border-2 border-accent font-semibold',
        sizeClasses[size],
        className
      )}
      aria-label={`${label} sessions`}
    >
      <Award className={cn('text-black', iconSizes[size])} />
      <span>{label}</span>
    </div>
  );
}
