'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type WindowRow = { day_of_week: number; start_time: string; end_time: string };
type BlockRow = { id: string; blocked_date: string; reason: string | null };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function CoachProfileAvailabilitySection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [pickDay, setPickDay] = useState<number>(1);
  const [pickStart, setPickStart] = useState('15:00');
  const [pickEnd, setPickEnd] = useState('19:00');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wRes, bRes] = await Promise.all([
        fetch('/api/coach/availability/weekly'),
        fetch('/api/coach/availability/blocks'),
      ]);
      const wData = await wRes.json();
      const bData = await bRes.json();
      if (!wRes.ok) throw new Error(wData.error || 'Failed to load weekly availability');
      if (bRes.ok && Array.isArray(bData.blocks)) {
        setBlocks(bData.blocks);
      }
      const list = (wData.windows || []) as { day_of_week: number; start_time: string; end_time: string }[];
      setWindows(list.map((r) => ({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveWeekly = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/coach/availability/weekly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addWindow = () => {
    setWindows((prev) => [...prev, { day_of_week: pickDay, start_time: pickStart, end_time: pickEnd }]);
  };

  const removeWindow = (index: number) => {
    setWindows((prev) => prev.filter((_, i) => i !== index));
  };

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
        <CardTitle>Availability</CardTitle>
        <CardDescription>
          Weekly hours (Eastern) tell parents when they can request private or partner sessions. Date-specific openings
          are still managed on{' '}
          <Link href="/availability" className="text-accent font-medium underline">
            the calendar page
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-3">
          <p className="text-sm font-medium">Weekly windows</p>
          {windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recurring windows yet. Add at least one (60+ minutes).</p>
          ) : (
            <ul className="space-y-2">
              {windows.map((w, i) => (
                <li
                  key={`${w.day_of_week}-${i}-${w.start_time}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {DAY_LABELS[w.day_of_week]} · {w.start_time} – {w.end_time}
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="min-h-[40px]" onClick={() => removeWindow(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-2">
              <Label>Day</Label>
              <select
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={pickDay}
                onChange={(e) => setPickDay(Number(e.target.value))}
              >
                {DAY_LABELS.map((label, d) => (
                  <option key={label} value={d}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="time" value={pickStart} onChange={(e) => setPickStart(e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="time" value={pickEnd} onChange={(e) => setPickEnd(e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={addWindow}>
                <Plus className="h-4 w-4 mr-2" />
                Add window
              </Button>
            </div>
          </div>

          <Button type="button" className="min-h-[44px]" onClick={() => void saveWeekly()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save weekly hours'}
          </Button>
        </div>

        <div className="space-y-3 border-t border-border pt-6">
          <p className="text-sm font-medium">Block specific dates</p>
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
