import { BackLink } from '@/components/back-link';

export default function SessionNotFound() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-2">Session not found</h1>
      <p className="text-muted-foreground text-sm mb-4">
        This session may have been cancelled, or the link might be wrong. If you opened this from My
        bookings, try refreshing that page and opening View again.
      </p>
      <BackLink
        fallbackHref="/bookings"
        label="Back to My bookings"
        className="text-sm text-accent hover:underline"
      />
    </div>
  );
}
