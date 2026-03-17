'use client';

import { cn } from '@/lib/utils';

/**
 * Shows registered/capacity (e.g. 5/6) with color:
 * - Green: open (at least 2 spots left)
 * - Yellow: almost full (1 spot left)
 * - Red: full
 */
export function CapacityBadge({
  current,
  max,
  className,
  label = 'spots',
}: {
  current: number;
  max: number;
  className?: string;
  label?: string;
}) {
  const cur = Math.max(0, current);
  const cap = Math.max(1, max);
  const isFull = cur >= cap;
  const isAlmostFull = cap > 1 && cur >= cap - 1 && !isFull;

  const variant = isFull ? 'full' : isAlmostFull ? 'almostFull' : 'open';
  const bgClass =
    variant === 'full'
      ? 'bg-destructive/15 text-destructive border-destructive/40'
      : variant === 'almostFull'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40'
        : 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/40';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums',
        bgClass,
        className
      )}
      title={variant === 'full' ? 'Full' : variant === 'almostFull' ? 'Almost full' : 'Open'}
    >
      {cur}/{cap}
      {label && <span className="font-normal opacity-90">{label}</span>}
    </span>
  );
}
