'use client';

/**
 * Prominent, color-coded session type for cards. Private / Partner / Small group.
 */
export function getSessionTypeDisplay(sessionType?: string | null, sessionMode?: string | null): {
  label: string;
  className: string;
} {
  // Partner session (2 wrestlers) - DB value is '2-athlete'
  if (sessionType === 'partner' || sessionType === '2-athlete' || sessionMode === 'partner-open') {
    return {
      label: 'Partner',
      className:
        'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border-emerald-500/50',
    };
  }
  // Small group (up to 6) - DB value is 'group'
  if (sessionType === 'small_group' || sessionType === 'group') {
    return {
      label: 'Small Group',
      className:
        'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-violet-500/25 text-violet-800 dark:text-violet-200 border-violet-500/50',
    };
  }
  // Private / 1-on-1 / default - DB value is '1-on-1'
  return {
    label: 'Private',
    className:
      'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-blue-500/25 text-blue-800 dark:text-blue-200 border-blue-500/50',
  };
}

interface SessionTypeBadgeProps {
  sessionType?: string | null;
  sessionMode?: string | null;
}

export function SessionTypeBadge({ sessionType, sessionMode }: SessionTypeBadgeProps) {
  const { label, className } = getSessionTypeDisplay(sessionType, sessionMode);
  return <span className={className}>{label}</span>;
}
