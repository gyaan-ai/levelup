'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BackLinkProps = {
  /** Used when there is no prior history entry (direct visit, new tab). */
  fallbackHref: string;
  label: string;
  className?: string;
  hideIcon?: boolean;
};

/**
 * Prefer browser back when possible; otherwise navigates to `fallbackHref`.
 */
export function BackLink({ fallbackHref, label, className, hideIcon }: BackLinkProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      className={cn(
        'inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground text-left',
        className
      )}
    >
      {!hideIcon && <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />}
      <span>{label}</span>
    </button>
  );
}
