'use client';

import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';

const MILESTONES = [
  { min: 50, label: '50 Sessions' },
  { min: 25, label: '25 Sessions' },
  { min: 10, label: '10 Sessions' },
  { min: 1, label: '1st Session' },
] as const;

function getMilestone(totalSessions: number): { label: string } | null {
  for (const m of MILESTONES) {
    if (totalSessions >= m.min) return { label: m.label };
  }
  return null;
}

interface CoachSessionBadgeProps {
  totalSessions: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CoachSessionBadge({ totalSessions, className, size = 'md' }: CoachSessionBadgeProps) {
  const milestone = getMilestone(totalSessions);
  if (!milestone) return null;

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
        'inline-flex items-center bg-primary text-white rounded-full border-2 border-accent font-semibold',
        sizeClasses[size],
        className
      )}
      aria-label={`${milestone.label} completed`}
    >
      <Award className={cn('text-accent', iconSizes[size])} />
      <span>{milestone.label}</span>
    </div>
  );
}
