'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProfileImageProps {
  src: string | null | undefined;
  alt: string;
  /** 0–100, horizontal focus (face position). Default 50 = center. */
  focusX?: number | null;
  /** 0–100, vertical focus (face position). Default 25 = anchor high so full head fits in circle. */
  focusY?: number | null;
  /** 'full' for avatars, 'lg' for cards. Default 'full'. */
  rounded?: 'full' | 'lg' | 'md' | 'none';
  className?: string;
  /** Optional: size for the fallback placeholder to match. */
  fallbackIconClassName?: string;
}

/**
 * Profile/avatar image that:
 * - Uses <img> so external URLs (e.g. Supabase storage) always load
 * - Applies object-position from focusX/focusY so faces aren't cut off
 * - Shows a placeholder on load error so broken URLs don't show broken icon
 */
const roundedClass = { full: 'rounded-full', lg: 'rounded-lg', md: 'rounded-md', none: '' } as const;

export function ProfileImage({
  src,
  alt,
  focusX = 50,
  focusY = 25,
  rounded = 'full',
  className,
  fallbackIconClassName = 'h-1/3 w-1/3 text-muted-foreground',
}: ProfileImageProps) {
  const [error, setError] = useState(false);
  const x = focusX != null ? Math.min(100, Math.max(0, focusX)) : 50;
  const y = focusY != null ? Math.min(100, Math.max(0, focusY)) : 25;
  const roundedCn = roundedClass[rounded];

  if (!src || error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted overflow-hidden',
          roundedCn,
          className
        )}
        aria-hidden
      >
        <User className={cn('shrink-0', fallbackIconClassName)} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn('object-cover', roundedCn, className)}
      style={{ objectPosition: `${x}% ${y}%` }}
      onError={() => setError(true)}
    />
  );
}
