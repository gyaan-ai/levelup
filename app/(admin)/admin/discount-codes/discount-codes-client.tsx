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
  percent_off?: number | null;
  created_at: string;
};

export function DiscountCodesClient({ initialCodes }: { initialCodes: CodeRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [percentOff, setPercentOff] = useState('');
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
          percent_off: percentOff.trim() === '' ? undefined : parseInt(percentOff, 10),
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
          Set &quot;Percent off&quot; (e.g. 10) for family pricing — parent gets that % off sessions. Codes like FAMILY10 also work if the code string matches that pattern. Leave blank only for non-discount / legacy rows.
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
          <div>
            <Label htmlFor="new-percent">Percent off (optional)</Label>
            <Input
              id="new-percent"
              type="number"
              min={1}
              max={100}
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              placeholder="e.g. 10 for 10% off (family discount)"
              className="mt-1"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">Set 10 for 10% off. FAMILY10-style codes infer percent if this is left blank.</p>
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
