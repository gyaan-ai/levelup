'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProfileImageProps {
  src: string | null | undefined;
  alt: string;
  /** 0–100, horizontal focus (face position). Default 50 = center. */
  focusX?: number | null;
  /** 0–100, vertical focus (face position). Default 15 = anchor near top so full head fits in circle. */
  focusY?: number | null;
  /** 'full' for avatars, 'lg' for cards. Default 'full'. */
  rounded?: 'full' | 'lg' | 'md' | 'none';
  className?: string;
  /** Optional: size for the fallback placeholder to match. */
  fallbackIconClassName?: string;
  /**
   * `cover` fills the box (may crop). `contain` fits the whole image inside the box (letterboxing);
   * use for coach card heroes where full head + gear must stay visible.
   */
  fit?: 'cover' | 'contain';
}

/**
 * Profile/avatar image that:
 * - Uses <img> so external URLs (e.g. Supabase storage) always load
 * - For circular avatars (rounded='full'): always anchors vertical at 15% so professional
 *   headshots (head at top of image) show the full head and are never cut off.
 * - For non-circle crops (rounded='lg' etc.), uses focusX/focusY with `fit='cover'`, or `fit='contain'`
 *   to show the full image (letterboxed) in card heroes.
 * - Shows a placeholder on load error so broken URLs don't show broken icon
 */
const roundedClass = { full: 'rounded-full', lg: 'rounded-lg', md: 'rounded-md', none: '' } as const;

/** Vertical position 15% = anchor near top so full head is visible in circle (professional headshots). */
const CIRCLE_HEAD_SAFE_Y = 15;

export function ProfileImage({
  src,
  alt,
  focusX = 50,
  focusY = 15,
  rounded = 'full',
  className,
  fallbackIconClassName = 'h-1/3 w-1/3 text-muted-foreground',
  fit = 'cover',
}: ProfileImageProps) {
  const [error, setError] = useState(false);
  const x = focusX != null ? Math.min(100, Math.max(0, focusX)) : 50;
  // Circular avatars: always use head-safe crop so coach/headshots are never cut off
  const y = rounded === 'full' ? CIRCLE_HEAD_SAFE_Y : (focusY != null ? Math.min(100, Math.max(0, focusY)) : 15);
  const roundedCn = roundedClass[rounded];
  const objectFitClass = fit === 'contain' ? 'object-contain' : 'object-cover';

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
      className={cn(objectFitClass, roundedCn, className)}
      style={fit === 'contain' ? { objectPosition: 'center' } : { objectPosition: `${x}% ${y}%` }}
      onError={() => setError(true)}
    />
  );
}
