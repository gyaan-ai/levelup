'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CodeRow = {
  id: string;
  code: string;
  name?: string | null;
  max_redemptions?: number | null;
  redemptions: number;
  created_at: string;
};

export function DiscountCodesClient({ initialCodes }: { initialCodes: CodeRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmed,
          name: name.trim() || undefined,
          max_redemptions: maxRedemptions.trim() === '' ? undefined : parseInt(maxRedemptions, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create code');
        return;
      }
      setCode('');
      setName('');
      setMaxRedemptions('');
      router.refresh();
    } catch {
      setError('Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new code</CardTitle>
        <CardDescription>
          Parents enter this code on signup (optional field when role is Parent) to get 1 free private + 1 free small group session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <Label htmlFor="new-code">Code</Label>
            <Input
              id="new-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BETA2025"
              className="font-mono mt-1"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">Uppercase, no spaces. Must be unique.</p>
          </div>
          <div>
            <Label htmlFor="new-name">Name (optional)</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Early Adopter"
              className="mt-1"
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="new-max">Max redemptions (optional)</Label>
            <Input
              id="new-max"
              type="number"
              min={0}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="mt-1"
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create code'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
