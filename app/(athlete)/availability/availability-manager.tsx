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
import { Sparkles } from 'lucide-react';

const SLOTS_24H = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
];

type Slot = { id: string; slot_date: string; start_time: string; end_time: string };

export function AvailabilityManager() {
  const [list, setList] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyWindowCount, setWeeklyWindowCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [start, setStart] = useState<string>('09:00');
  const [end, setEnd] = useState<string>('17:00');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyBanner, setApplyBanner] = useState<{
    tone: 'success' | 'error' | 'neutral';
    msg: string;
  } | null>(null);

  const refreshSlots = useCallback(async () => {
    const r = await fetch('/api/availability/me');
    const data = await r.json();
    if (r.ok && Array.isArray(data.availability)) {
      setList(data.availability);
    }
  }, []);

  const refreshWeekly = useCallback(async () => {
    const r = await fetch('/api/coach/availability/weekly');
    const data = await r.json();
    if (r.ok && Array.isArray(data.windows)) {
      setWeeklyWindowCount(data.windows.length);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([refreshSlots(), refreshWeekly()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSlots, refreshWeekly]);

  useEffect(() => {
    const onSaved = () => void refreshWeekly();
    window.addEventListener('coach-weekly-availability-saved', onSaved);
    return () => window.removeEventListener('coach-weekly-availability-saved', onSaved);
  }, [refreshWeekly]);

  const handleApplyWeekly = async () => {
    setApplyBanner(null);
    setApplyLoading(true);
    try {
      const r = await fetch('/api/coach/availability/apply-weekly-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 14 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not apply weekly hours');
      await refreshSlots();
      setApplyBanner(
        data.added > 0
          ? {
              tone: 'success',
              msg: `Added ${data.added} opening${data.added === 1 ? '' : 's'} for the next two weeks (skips blocked days and times you already added).`,
            }
          : {
              tone: 'neutral',
              msg: String(data.message || 'No new openings — you may already be covered for those days.'),
            }
      );
    } catch (e) {
      setApplyBanner({
        tone: 'error',
        msg: e instanceof Error ? e.message : 'Something went wrong',
      });
    } finally {
      setApplyLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedDate) {
      window.alert('Please select a date.');
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
      const slotDate = formatEST(selectedDate, 'yyyy-MM-dd');
      const r = await fetch('/api/availability/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_date: slotDate, start_time: start, end_time: end }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to add');
      await refreshSlots();
      setSelectedDate(undefined);
      setStart('09:00');
      setEnd('17:00');
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
      <Card className="border-[#D4AF37]/25 bg-[#D4AF37]/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-5 w-5 text-[#D4AF37] shrink-0" aria-hidden />
            Quick fill (every week)
          </CardTitle>
          <CardDescription>
            One tap copies your <strong>weekly template</strong> above onto the <strong>next 14 days</strong>. Blocked
            days are skipped; existing times are not duplicated. Adjust with the calendar below anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {applyBanner ? (
            <p
              className={`text-sm rounded-md px-3 py-2 ${
                applyBanner.tone === 'success'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : applyBanner.tone === 'error'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {applyBanner.msg}
            </p>
          ) : null}
          <Button
            type="button"
            className="min-h-[48px] w-full sm:w-auto bg-[#D4AF37] text-black hover:bg-[#c9a432] font-semibold touch-manipulation"
            onClick={() => void handleApplyWeekly()}
            disabled={applyLoading || weeklyWindowCount === 0}
          >
            {applyLoading ? 'Working…' : 'Fill next 2 weeks from weekly hours'}
          </Button>
          {weeklyWindowCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Save at least one weekly window in the section above, then come back here.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a time slot</CardTitle>
          <CardDescription>
            Pick a date, pick start and end time, then tap Add. Parents see these when they book private or partner
            sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Date</label>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < startOfDay(new Date())}
                className="rounded-md border"
              />
            </div>
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
            <Button onClick={() => void handleAdd()} disabled={adding || !selectedDate}>
              {adding ? 'Adding…' : 'Add slot'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your dated openings</CardTitle>
          <CardDescription>
            {list.length === 0
              ? 'No slots yet — use Quick fill or add one above.'
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
