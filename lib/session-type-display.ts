/**
 * Pure session type labels/styles — safe on server or client (no 'use client').
 */
export function getSessionTypeDisplay(sessionType?: string | null, sessionMode?: string | null): {
  label: string;
  className: string;
} {
  if (sessionType === 'small_group' || sessionType === 'group') {
    return {
      label: 'Small Group',
      className:
        'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-violet-500/25 text-violet-800 dark:text-violet-200 border-violet-500/50',
    };
  }
  if (sessionType === 'partner' || sessionType === '2-athlete') {
    return {
      label: 'Partner',
      className:
        'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border-emerald-500/50',
    };
  }
  if (sessionType === 'private' || sessionType === '1-on-1') {
    return {
      label: 'Private',
      className:
        'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-blue-500/25 text-blue-800 dark:text-blue-200 border-blue-500/50',
    };
  }
  if (sessionMode === 'partner-open') {
    return {
      label: 'Partner',
      className:
        'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border-emerald-500/50',
    };
  }
  return {
    label: 'Private',
    className:
      'inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-blue-500/25 text-blue-800 dark:text-blue-200 border-blue-500/50',
  };
}
