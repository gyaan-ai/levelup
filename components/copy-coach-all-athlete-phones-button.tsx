'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Users } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';

type PrefetchState =
  | { status: 'loading' }
  | { status: 'error'; message?: string }
  | { status: 'ready'; text: string };

/**
 * Coach: copy every distinct athlete cell on file for youths who have ever been on one of
 * this coach’s sessions (one 10-digit line per number — same as per-session Copy Cell #s).
 */
export function CopyCoachAllAthletePhonesButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [prefetch, setPrefetch] = useState<PrefetchState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setPrefetch({ status: 'loading' });
    void (async () => {
      try {
        const r = await fetch('/api/coach/all-session-athlete-phones');
        const data = (await r.json()) as { commaAll?: string; error?: string };
        if (cancelled) return;
        if (!r.ok) {
          setPrefetch({ status: 'error', message: data.error });
          return;
        }
        setPrefetch({ status: 'ready', text: (data.commaAll ?? '').trim() });
      } catch {
        if (!cancelled) setPrefetch({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onClick = async () => {
    setLoading(true);
    try {
      let text = prefetch.status === 'ready' ? prefetch.text : '';

      if (prefetch.status === 'loading' || prefetch.status === 'error') {
        const r = await fetch('/api/coach/all-session-athlete-phones');
        const data = (await r.json()) as { commaAll?: string; error?: string };
        if (!r.ok) {
          window.alert(data.error || 'Could not load numbers.');
          return;
        }
        text = (data.commaAll ?? '').trim();
        setPrefetch({ status: 'ready', text });
      }

      if (!text) {
        window.alert('No athlete cell numbers on file yet for wrestlers who have joined your sessions.');
        return;
      }

      const ok = await copyTextToClipboard(text);
      if (!ok) {
        window.alert(
          'Could not copy automatically. Try Chrome or Safari on desktop, or copy from your phone’s browser.'
        );
        return;
      }
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={onClick}
      disabled={loading}
      title="Copies one athlete number per line (everyone who has ever been on your sessions, deduped)"
    >
      {done ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Users className="h-4 w-4 mr-1" />}
      {done ? 'Copied' : loading ? 'Working…' : 'Copy all athletes’ cells'}
    </Button>
  );
}
