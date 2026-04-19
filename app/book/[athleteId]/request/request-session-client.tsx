'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { ProfileImage } from '@/components/profile-image';
import { SchoolLogo } from '@/components/school-logo';
import type { YouthWrestler } from '@/types';
import { startOfDay } from 'date-fns';
import { formatEST } from '@/lib/format-date';
import { formatSlotDisplay, getDayOfWeek } from '@/lib/availability';

type Athlete = {
  id: string;
  first_name: string;
  last_name: string;
  school: string;
  photo_url?: string;
  photo_focus_x?: number;
  photo_focus_y?: number;
};

type Facility = { id: string; name: string; school?: string };

type Props = {
  athlete: Athlete;
  facilities: Facility[];
  youthWrestlers: YouthWrestler[];
  preselectedYouthWrestlerId?: string | null;
};

type AvailabilityByDay = { day_of_week: number; start_time: string; end_time: string }[];

const SUGGESTIONS = ['Takedowns', 'Leg riding', 'Match prep', 'General technique'];

export function RequestSessionClient({
  athlete,
  facilities,
  youthWrestlers,
  preselectedYouthWrestlerId = null,
}: Props) {
  const router = useRouter();
  const [youthWrestlerId, setYouthWrestlerId] = useState(
    () => preselectedYouthWrestlerId || youthWrestlers[0]?.id || ''
  );
  const [facilityId, setFacilityId] = useState<string>('any');
  const [sessionType, setSessionType] = useState<string>('private');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [message, setMessage] = useState('');
  const [flexibilityNote, setFlexibilityNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availability, setAvailability] = useState<AvailabilityByDay | null>(null);
  const [availabilityDates, setAvailabilityDates] = useState<Set<string>>(new Set());
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const r = await fetch(`/api/availability?athleteId=${encodeURIComponent(athlete.id)}`);
        const data = await r.json();
        if (!ok || !r.ok) return;
        if (Array.isArray(data.availability)) setAvailability(data.availability);
        if (Array.isArray(data.availabilityDates)) setAvailabilityDates(new Set(data.availabilityDates));
        if (Array.isArray(data.blockedDates)) setBlockedDates(new Set(data.blockedDates));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      ok = false;
    };
  }, [athlete.id]);

  const hasAvailability =
    (availability?.length ?? 0) > 0 || (availabilityDates?.size ?? 0) > 0;
  const daysWithSlots = new Set(availability?.map((a) => a.day_of_week) ?? []);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedTime(null);
      return;
    }
    setSelectedTime(null);
    let cancelled = false;
    setSlotsLoading(true);
    const dateStr = formatEST(selectedDate, 'yyyy-MM-dd');
    fetch(`/api/availability/slots?athleteId=${encodeURIComponent(athlete.id)}&date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athlete.id, selectedDate]);

  const buildPreferredIso = (): string | null => {
    if (selectedDate && selectedTime) {
      const dateStr = formatEST(selectedDate, 'yyyy-MM-dd');
      return `${dateStr}T${selectedTime}:00`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!youthWrestlerId) {
      setError('Select a wrestler.');
      return;
    }

    const preferredDatetime = buildPreferredIso();
    const msg = message.trim();
    const flex = flexibilityNote.trim();

    if (hasAvailability && (!selectedDate || !selectedTime)) {
      setError('Choose a date and time from the coach’s available slots.');
      return;
    }

    if (!preferredDatetime && !msg && !flex) {
      setError('Add a preferred time, a message, or when you are flexible.');
      return;
    }

    if (msg.length > 300) {
      setError('Message must be 300 characters or less.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/parent-session-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: athlete.id,
          youthWrestlerId,
          facilityId: facilityId === 'any' ? null : facilityId,
          sessionType: sessionType === 'any' ? null : sessionType,
          preferredDatetime,
          durationMinutes,
          message: msg || null,
          flexibilityNote: flex || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      router.push('/session-requests?submitted=1');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (youthWrestlers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-lg">
        <div className="mb-4">
          <BackLink fallbackHref={`/book/${athlete.id}`} label="Back to booking" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Add a wrestler first</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need at least one youth wrestler on your account to request a session.
            </p>
            <Button asChild className="w-full">
              <Link href={`/wrestlers/add?redirect=${encodeURIComponent(`/book/${athlete.id}/request`)}`}>
                Add wrestler
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-lg">
      <div className="mb-4">
        <BackLink fallbackHref={`/book/${athlete.id}`} label="Back to booking" />
      </div>

      <div className="flex items-center gap-4 mb-6">
        <ProfileImage
          src={athlete.photo_url}
          alt={`${athlete.first_name} ${athlete.last_name}`}
          focusX={athlete.photo_focus_x}
          focusY={athlete.photo_focus_y}
          className="w-14 h-14 shrink-0"
          fallbackIconClassName="h-7 w-7 text-muted-foreground"
        />
        <div>
          <h1 className="text-xl font-bold">Request a session</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <SchoolLogo school={athlete.school} size="sm" />
            {athlete.first_name} {athlete.last_name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pick time</CardTitle>
            <p className="text-sm text-muted-foreground">
              Times shown respect this coach’s availability. No payment until they approve.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => {
                  if (date < startOfDay(new Date())) return true;
                  const dateStr = formatEST(date, 'yyyy-MM-dd');
                  if (blockedDates.has(dateStr)) return true;
                  if (availabilityDates.has(dateStr)) return false;
                  if (daysWithSlots.has(getDayOfWeek(date))) return false;
                  return hasAvailability;
                }}
                className="rounded-md border"
              />
            </div>
            {selectedDate && (
              <div>
                <h3 className="font-semibold mb-3 text-sm">Time (Eastern)</h3>
                {slotsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading slots…</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No times available this day.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTime(t)}
                        className={`min-h-[44px] p-2 rounded-lg border text-sm touch-manipulation ${
                          selectedTime === t ? 'border-accent bg-accent text-black' : 'border-border hover:border-accent/50'
                        }`}
                      >
                        {formatSlotDisplay(t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!hasAvailability && (
              <p className="text-xs text-muted-foreground">
                This coach has not published weekly hours yet. You can still send a message below with times that work
                for you.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yw">Wrestler</Label>
              <Select value={youthWrestlerId} onValueChange={setYouthWrestlerId}>
                <SelectTrigger id="yw" className="min-h-[44px]">
                  <SelectValue placeholder="Select wrestler" />
                </SelectTrigger>
                <SelectContent>
                  {youthWrestlers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.first_name} {w.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stype">Session type</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger id="stype" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private (1:1)</SelectItem>
                  <SelectItem value="partner">Partner (2 athletes)</SelectItem>
                </SelectContent>
              </Select>
              {sessionType === 'partner' && (
                <p className="text-xs text-muted-foreground">
                  You can invite a second family after booking, or note in the message that you need a partner.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={String(durationMinutes)} onValueChange={(v) => setDurationMinutes(Number(v))}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fac">Facility (optional)</Label>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger id="fac" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Coach default</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="msg">Note (optional, max 300)</Label>
              <div className="flex flex-wrap gap-2 mb-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs rounded-full border border-border px-2 py-1 hover:bg-muted"
                    onClick={() => setMessage((prev) => (prev ? `${prev} ${s}` : s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Textarea
                id="msg"
                rows={4}
                placeholder="What do you want to work on?"
                value={message}
                maxLength={300}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-y min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/300</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="flex">Scheduling flexibility</Label>
              <Textarea
                id="flex"
                rows={2}
                placeholder="e.g. weekday evenings, or any time next week"
                value={flexibilityNote}
                onChange={(e) => setFlexibilityNote(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full min-h-[44px]" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                'Submit request'
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
