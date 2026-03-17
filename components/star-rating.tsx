'use client';

import { Star } from 'lucide-react';

/** Shows 1–5 stars (filled by average rating), numeric label or "New", and (N reviews). Use on every coach card. */
export function StarRating({
  averageRating,
  reviewCount,
  size = 'md',
}: {
  averageRating: number | string | null | undefined;
  reviewCount?: number | string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const rating = Number(averageRating) || 0;
  const count = Number(reviewCount) || 0;
  const filled = Math.round(rating);
  const displayLabel = rating > 0 ? rating.toFixed(1) : 'New';
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-sm">
      <div className="flex gap-0.5" aria-label={rating > 0 ? `${displayLabel} out of 5 stars` : 'No reviews yet'}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${starSize} shrink-0 ${i <= filled ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
          />
        ))}
      </div>
      <span className="font-medium">{displayLabel}</span>
      {count > 0 && (
        <span className="text-muted-foreground">
          ({count} {count === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
}
