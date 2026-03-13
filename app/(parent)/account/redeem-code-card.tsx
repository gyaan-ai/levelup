'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from 'lucide-react';

type Props = {
  hasEntitlements: boolean;
};

export function RedeemCodeCard({ hasEntitlements }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Enter a code' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/redeem-discount-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to redeem code' });
        return;
      }
      setMessage({ type: 'success', text: data.message || 'Code applied.' });
      setCode('');
      window.location.reload();
    } catch {
      setMessage({ type: 'error', text: 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  if (hasEntitlements) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Discount code
          </CardTitle>
          <CardDescription>You have early adopter benefits (1 free private + 1 free small group session).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Use them when you book a private/partner session or join a small group — no payment will be charged.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Redeem discount code
        </CardTitle>
        <CardDescription>
          Have a code like GUILDLAUNCH? Enter it here for 1 free private + 1 free small group session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. GUILDLAUNCH"
            className="font-mono max-w-xs"
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Applying…' : 'Redeem code'}
          </Button>
          {message && (
            <p className={message.type === 'success' ? 'text-sm text-green-600 dark:text-green-400' : 'text-sm text-destructive'}>
              {message.text}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
