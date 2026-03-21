'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

type Props = {
  sessionId: string;
  className?: string;
};

/** Coach-only: copy comma-separated 10-digit US cells (paste into Messages To field). */
export function CopySessionPhonesButton({ sessionId, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/sessions/${sessionId}/sms-phones`);
      const data = (await r.json()) as {
        commaAll?: string;
        error?: string;
      };
      if (!r.ok) {
        window.alert(data.error || 'Could not load numbers.');
        return;
      }
      const text = (data.commaAll ?? '').trim();
      if (!text) {
        window.alert('No phone numbers on file for this session yet.');
        return;
      }
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      window.alert('Could not copy — try again.');
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
      title="Copies comma-separated 10-digit numbers — paste into your phone’s Messages To field"
    >
      {done ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Copy className="h-4 w-4 mr-1" />}
      {done ? 'Copied' : 'Copy Cell #s'}
    </Button>
  );
}
