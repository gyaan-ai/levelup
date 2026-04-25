'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, ChevronRight } from 'lucide-react';

type Props = {
  compact?: boolean;
};

export function RedeemCodeCard({ compact }: Props) {
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

  if (compact) {
    return (
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Tag className="h-5 w-5 text-zinc-400" />
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
              className="h-9 flex-1 font-mono text-sm"
              disabled={loading}
            />
            <Button type="submit" size="sm" disabled={loading} className="h-9">
              {loading ? '...' : 'Apply'}
            </Button>
          </form>
        </div>
        {message && (
          <p className={`text-xs mt-2 pl-8 ${message.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
            {message.text}
          </p>
        )}
      </div>
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
          Have a code from your coach or organization? Enter it here to apply your discount.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
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
