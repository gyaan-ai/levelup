'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Loader2 } from 'lucide-react';

const TAG_OPTIONS = ['Technique', 'Great with kids', 'Punctual', 'Communication', 'My kid loved it'];

export function SessionReviewForm({
  sessionId,
  existingReview,
}: {
  sessionId: string;
  existingReview: { rating: number; comment: string; tags: string[] } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [tags, setTags] = useState<string[]>(existingReview?.tags ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a star rating.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          rating,
          comment: comment.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      router.push('/bookings');
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your feedback</CardTitle>
        <CardDescription>
          Your review will be shown on the coach&apos;s profile. Stars are required; your own words are optional but help other parents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Rating *</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  aria-label={`${i} star${i > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`h-10 w-10 transition-colors ${
                      i <= displayRating ? 'fill-accent text-accent' : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="review-comment" className="text-sm font-medium mb-2 block">
              Your own words (optional)
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you or your wrestler appreciate? Anything that stood out?"
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">{comment.length}/1000</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Quick tags (optional)</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    tags.includes(tag)
                      ? 'bg-accent text-primary border-accent'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || rating < 1}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting…
              </>
            ) : existingReview ? (
              'Update feedback'
            ) : (
              'Submit feedback'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
