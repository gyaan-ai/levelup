'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatSlotDisplay } from '@/lib/availability';

const DAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const SLOTS_24H = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
];

type Slot = { id: string; day_of_week: number; start_time: string; end_time: string };

export function AvailabilityManager() {
  const [list, setList] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<number>(0);
  const [start, setStart] = useState<string>('09:00');
  const [end, setEnd] = useState<string>('17:00');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      const r = await fetch('/api/availability/me');
      const data = await r.json();
      if (r.ok && Array.isArray(data.availability)) {
        setList(data.availability);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleAdd = async () => {
    const startM = parseInt(start.split(':')[0], 10) * 60 + parseInt(start.split(':')[1] || '0', 10);
    const endM = parseInt(end.split(':')[0], 10) * 60 + parseInt(end.split(':')[1] || '0', 10);
    if (endM <= startM) {
      alert('End time must be after start time.');
      return;
    }
    setAdding(true);
    try {
      const r = await fetch('/api/availability/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_of_week: day, start_time: start, end_time: end }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to add');
      await fetchList();
      setStart('09:00');
      setEnd('17:00');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add slot');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const r = await fetch(`/api/availability/me?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || 'Failed to delete');
      }
      await fetchList();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a time slot</CardTitle>
          <CardDescription>
            Choose a day and start/end time. Parents will only see these slots when booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label className="text-sm font-medium mb-1 block">Day</label>
            <Select value={String(day)} onValueChange={(v) => setDay(parseInt(v, 10))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <label className="text-sm font-medium mb-1 block">Start</label>
            <Select value={start} onValueChange={setStart}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOTS_24H.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatSlotDisplay(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <label className="text-sm font-medium mb-1 block">End</label>
            <Select value={end} onValueChange={setEnd}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOTS_24H.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatSlotDisplay(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : 'Add slot'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your availability</CardTitle>
          <CardDescription>
            {list.length === 0
              ? 'No slots yet. Add one above.'
              : 'Recurring weekly. Parents see these when booking.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No slots added yet.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg border bg-muted/30"
                >
                  <span className="font-medium">
                    {DAYS.find((d) => d.value === s.day_of_week)?.label ?? '?'} · {formatSlotDisplay(s.start_time)} – {formatSlotDisplay(s.end_time)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                  >
                    {deleting === s.id ? 'Removing…' : 'Remove'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
