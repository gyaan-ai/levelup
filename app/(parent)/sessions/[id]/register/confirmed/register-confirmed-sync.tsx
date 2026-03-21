'use client';

import { useEffect, useState } from 'react';

type Status = 'loading' | 'enrolled' | 'pending' | 'timeout';

/**
 * After Stripe, the webhook may lag; server also finalizes via stripe_cs. Poll until DB shows enrollment.
 */
export function RegisterConfirmedSync({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    const maxAttempts = 24;
    const intervalMs = 1500;

    const run = async () => {
      for (let i = 0; i < maxAttempts; i++) {
        if (cancelled) return;
        if (i > 0) setStatus('pending');
        try {
          const r = await fetch(`/api/sessions/${sessionId}/registration-status`);
          const d = (await r.json()) as { enrolled?: boolean; needAuth?: boolean };
          if (cancelled) return;
          if (d.needAuth || d.enrolled) {
            setStatus('enrolled');
            return;
          }
        } catch {
          /* continue polling */
        }
        await new Promise((res) => setTimeout(res, intervalMs));
      }
      if (!cancelled) setStatus('timeout');
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === 'enrolled') return null;

  if (status === 'timeout') {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 mb-4">
        Your payment went through, but we&apos;re still linking this session to your account.{' '}
        <strong>Refresh Home or My bookings in a minute.</strong> If it still doesn&apos;t show, contact support with
        your receipt.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground mb-4">
      {status === 'loading' ? 'Confirming your spot…' : 'Linking this booking to your dashboard…'}
    </div>
  );
}
