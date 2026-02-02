'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, User } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';
import { format, startOfDay } from 'date-fns';
import { formatSlotDisplay, getDayOfWeek } from '@/lib/availability';

const TIME_SLOTS_24H = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
];

interface RescheduleClientProps {
  sessionId: string;
  athleteId: string;
  coachName: string;
  school: string;
  facilityName: string;
  currentDateTime: string;
}

export function RescheduleClient({
  sessionId,
  athleteId,
  coachName,
  school,
  facilityName,
  currentDateTime,
}: RescheduleClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<{ day_of_week: number }[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const hasAvailability = availability.length > 0;
  const daysWithSlots = new Set(availability.map((a) => a.day_of_week));

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const r = await fetch(`/api/availability?athleteId=${encodeURIComponent(athleteId)}`);
        if (!ok) return;
        const data = await r.json();
        if (r.ok && Array.isArray(data.availability)) {
          setAvailability(data.availability);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { ok = false; };
  }, [athleteId]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedTime(null);
      return;
    }
    setSelectedTime(null);
    if (!hasAvailability) {
      const now = new Date();
      const isToday =
        selectedDate.getFullYear() === now.getFullYear() &&
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getDate() === now.getDate();
      const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const fallback = isToday ? TIME_SLOTS_24H.filter((s) => s > currentHHmm) : TIME_SLOTS_24H;
      setSlots(fallback);
      return;
    }
    let ok = true;
    setSlotsLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    fetch(
      `/api/availability/slots?athleteId=${encodeURIComponent(athleteId)}&date=${dateStr}&excludeSessionId=${encodeURIComponent(sessionId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!ok) return;
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch(() => {
        if (ok) setSlots([]);
      })
      .finally(() => {
        if (ok) setSlotsLoading(false);
      });
    return () => { ok = false; };
  }, [athleteId, sessionId, selectedDate, hasAvailability]);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/sessions/${sessionId}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDate: dateStr,
          scheduledTime: selectedTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reschedule');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to reschedule');
    } finally {
      setLoading(false);
    }
  };

  const canConfirm = !!selectedDate && !!selectedTime;

  const currentDate = new Date(currentDateTime);

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary">Reschedule Session</h1>
        <p className="text-muted-foreground mt-1">
          Pick a new date and time. No additional payment.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Current session</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            {coachName}
            {school && (
              <span className="flex items-center gap-1">
                <SchoolLogo school={school} size="sm" />
                {school}
              </span>
            )}
          </div>
          <p className="text-sm">{facilityName}</p>
          <p className="text-sm font-medium">
            {format(currentDate, 'EEEE, MMMM d, yyyy')} at {format(currentDate, 'h:mm a')}
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New date & time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose when you&apos;d like to reschedule to.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                if (date < startOfDay(new Date())) return true;
                if (hasAvailability) {
                  const dow = getDayOfWeek(date);
                  return !daysWithSlots.has(dow);
                }
                return false;
              }}
              className="rounded-md border"
            />
          </div>
          {selectedDate && (
            <div>
              <h3 className="font-semibold mb-3">Time</h3>
              {slotsLoading ? (
                <p className="text-sm text-muted-foreground">Loading slots…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No times available this day.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={`min-h-[44px] p-2 rounded-lg border text-sm transition-all touch-manipulation ${
                        selectedTime === t
                          ? 'border-primary bg-primary text-white'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {formatSlotDisplay(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {selectedDate && selectedTime && (
            <p className="text-sm text-muted-foreground">
              New time: {format(selectedDate, 'EEEE, MMMM d, yyyy')} at {formatSlotDisplay(selectedTime)}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" asChild className="flex-1">
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || loading}
              className="flex-1"
            >
              {loading ? 'Rescheduling…' : 'Confirm reschedule'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
