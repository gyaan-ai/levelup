'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2 } from 'lucide-react';

type BlockRow = { id: string; blocked_date: string; reason: string | null };

type CoachAvailSectionProps = {
  /** Where this card is shown — adjusts helper text only */
  variant?: 'calendar-hub' | 'profile';
};

export function CoachProfileAvailabilitySection(props: CoachAvailSectionProps = {}) {
  const { variant = 'profile' } = props;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bRes = await fetch('/api/coach/availability/blocks');
      const bData = await bRes.json();
      if (!bRes.ok) throw new Error(bData.error || 'Failed to load blocked dates');
      if (Array.isArray(bData.blocks)) {
        setBlocks(bData.blocks);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addBlock = async () => {
    if (!newBlockDate.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/coach/availability/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_date: newBlockDate.trim(), reason: newBlockReason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to block date');
      setNewBlockDate('');
      setNewBlockReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const removeBlock = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/coach/availability/blocks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Block full days off</CardTitle>
        <CardDescription>
          {variant === 'calendar-hub' ? (
            <>
              Optional: mark whole days you&apos;re not taking private or partner requests. Your bookable hours are the
              dated openings you add in the calendar above.
            </>
          ) : (
            <>
              Mark whole days parents can&apos;t request you. Add your open hours on the{' '}
              <Link href="/availability" className="text-accent font-medium underline">
                availability calendar
              </Link>
              .
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Parents won&apos;t be able to request sessions on these days.</p>
          {blocks.length > 0 && (
            <ul className="space-y-2">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {b.blocked_date}
                    {b.reason ? ` — ${b.reason}` : ''}
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="min-h-[40px]" onClick={() => void removeBlock(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={newBlockDate}
                onChange={(e) => setNewBlockDate(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reason (optional)</Label>
              <Input
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="e.g. Travel"
                className="min-h-[44px]"
              />
            </div>
          </div>
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => void addBlock()} disabled={saving}>
            Add blocked date
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
