'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { startOfDay } from 'date-fns';
import { formatEST } from '@/lib/format-date';
import { formatSlotDisplay } from '@/lib/availability';

const SLOTS_24H = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
];

type Slot = { id: string; slot_date: string; start_time: string; end_time: string };

export function AvailabilityManager() {
  const [list, setList] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [start, setStart] = useState<string>('09:00');
  const [end, setEnd] = useState<string>('17:00');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refreshSlots = useCallback(async () => {
    const r = await fetch('/api/availability/me');
    const data = await r.json();
    if (r.ok && Array.isArray(data.availability)) {
      setList(data.availability);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refreshSlots();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSlots]);

  const handleAdd = async () => {
    if (selectedDates.length === 0) {
      window.alert('Please select one or more dates.');
      return;
    }
    const startM = parseInt(start.split(':')[0], 10) * 60 + parseInt(start.split(':')[1] || '0', 10);
    const endM = parseInt(end.split(':')[0], 10) * 60 + parseInt(end.split(':')[1] || '0', 10);
    if (endM <= startM) {
      window.alert('End time must be after start time.');
      return;
    }
    setAdding(true);
    try {
      let firstError: string | null = null;
      let ok = 0;
      for (const d of selectedDates) {
        const slotDate = formatEST(d, 'yyyy-MM-dd');
        const r = await fetch('/api/availability/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot_date: slotDate, start_time: start, end_time: end }),
        });
        const data = await r.json();
        if (!r.ok) {
          if (!firstError) firstError = (data.error as string) || 'Failed to add';
        } else {
          ok++;
        }
      }
      await refreshSlots();
      if (firstError) {
        window.alert(
          ok > 0
            ? `Added ${ok} slot(s). Some dates failed: ${firstError}`
            : firstError
        );
      } else {
        setSelectedDates([]);
        setStart('09:00');
        setEnd('17:00');
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to add slot');
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
      await refreshSlots();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete');
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
          <CardTitle>Your calendar</CardTitle>
          <CardDescription>
            Select one or more dates, choose when you&apos;re open, then add. Parents use these times for private and
            partner requests. Repeat for other time windows or weeks as needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Dates</label>
            <div className="flex justify-center">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates ?? [])}
                disabled={(date) => date < startOfDay(new Date())}
                className="rounded-md border"
              />
            </div>
            {selectedDates.length > 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-2">
                {selectedDates.length} day{selectedDates.length === 1 ? '' : 's'} selected
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-4">
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
            <Button onClick={() => void handleAdd()} disabled={adding || selectedDates.length === 0}>
              {adding ? 'Adding…' : selectedDates.length > 1 ? `Add opening (${selectedDates.length} days)` : 'Add opening'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming openings</CardTitle>
          <CardDescription>
            {list.length === 0
              ? 'No slots yet — add your hours with the calendar above.'
              : 'These are the times parents can book against.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No upcoming slots yet.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg border bg-muted/30 gap-2"
                >
                  <span className="font-medium text-sm sm:text-base min-w-0">
                    {formatEST(new Date(s.slot_date + 'T12:00:00'), 'EEE, MMM d, yyyy')} ·{' '}
                    {formatSlotDisplay(s.start_time)} – {formatSlotDisplay(s.end_time)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 min-h-[44px]"
                    onClick={() => void handleDelete(s.id)}
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
