import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReviewNotFound() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h1 className="text-xl font-semibold">Feedback page not available</h1>
        <p className="text-muted-foreground text-sm">
          This link may be outdated, the session may not be marked complete yet, or there may be a temporary issue. Go back to My bookings and try &quot;Leave feedback&quot; again from there.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/bookings" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to My bookings
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground pt-2">
            If it keeps happening, contact support and mention you were trying to leave feedback for a session.
          </p>
        </div>
      </div>
    </div>
  );
}
