'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Calendar, Users } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { SchoolLogo } from '@/components/school-logo';
import { SessionStatusPill } from '@/components/session-tile-utils';

type Facility = { id: string; name?: string; school?: string; address?: string | null };
type SessionRow = {
  id: string;
  scheduled_datetime: string;
  session_type: string | null;
  session_mode: string | null;
  focus_area: string | null;
  current_participants: number | null;
  max_participants: number | null;
  total_price: number | null;
  price_per_participant: number | null;
  athlete_id: string;
  facility_id: string;
  athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | null;
  facilities?: { id: string; name?: string; address?: string } | null;
};

export function FindTrainingClient({
  facilities,
  initialSessions,
  initialDate,
  initialTime,
  initialLocation,
  searchBasePath = '/find-training',
}: {
  facilities: Facility[];
  initialSessions: SessionRow[];
  initialDate: string;
  initialTime: string;
  initialLocation: string;
  /** When embedded in dashboard, pass '/dashboard' so search updates dashboard URL with tab=find-training */
  searchBasePath?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState(initialTime || 'any');
  const [location, setLocation] = useState(initialLocation || 'all');

  useEffect(() => {
    setDate(initialDate || '');
    setTime(initialTime || 'any');
    setLocation(initialLocation || 'all');
  }, [initialDate, initialTime, initialLocation]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchBasePath === '/dashboard') params.set('tab', 'find-training');
    if (date) params.set('date', date);
    if (time && time !== 'any') params.set('time', time);
    if (location && location !== 'all') params.set('location', location);
    router.push(`${searchBasePath}?${params.toString()}`);
  };

  const sessionTypeLabel = (s: SessionRow) => {
    if (s.session_mode === 'partner-open') return 'Partner (open)';
    if (s.session_type === 'small_group' || s.session_type === 'group') return 'Small group';
    return 'Session';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Search by date & time
          </CardTitle>
          <CardDescription>
            Pick a date, optional time window, and location to see open sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="find-date">Date</Label>
              <Input
                id="find-date"
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="find-time">Time of day</Label>
              <Select
                value={time}
                onValueChange={setTime}
              >
                <SelectTrigger id="find-time">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="morning">Morning (6am–12pm)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (12pm–5pm)</SelectItem>
                  <SelectItem value="evening">Evening (5pm–9pm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="find-location">Location</Label>
              <Select
                value={location}
                onValueChange={setLocation}
              >
                <SelectTrigger id="find-location">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.school ? ` (${f.school})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                className="w-full sm:w-auto"
              >
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!date ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Choose a date and click Search to see open sessions.</p>
          </CardContent>
        </Card>
      ) : initialSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No open sessions on this date.</p>
            <p className="text-sm mt-2">Try another date or remove the time/location filter.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Open sessions</CardTitle>
            <p className="text-sm text-muted-foreground">
              {initialSessions.length} session{initialSessions.length !== 1 ? 's' : ''} on {formatEST(new Date(date), 'EEEE, MMM d, yyyy')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {initialSessions.map((s) => {
                const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
                const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
                const current = s.current_participants ?? 0;
                const max = s.max_participants ?? 1;
                const dt = new Date(s.scheduled_datetime);
                const openSlots = max - current;

                return (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-accent uppercase tracking-wide">
                          {sessionTypeLabel(s)}
                        </span>
                        {s.focus_area && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">
                            {s.focus_area}
                          </span>
                        )}
                        <SessionStatusPill current={current} max={max} />
                      </div>
                      <p className="font-medium">
                        {formatEST(dt, 'h:mm a')}
                        {coach && (
                          <span className="text-muted-foreground font-normal ml-2">
                            · {[coach.first_name, coach.last_name].filter(Boolean).join(' ')}
                            {coach.school && <SchoolLogo school={coach.school} size="sm" className="ml-1 inline" />}
                          </span>
                        )}
                      </p>
                      {fac && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {fac.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {current} / {max} participants
                        {s.price_per_participant != null && (
                          <> · ${Number(s.price_per_participant).toFixed(2)}/person</>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 flex gap-2">
                      {openSlots > 0 && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/sessions/${s.id}/request-join`}>Request to join</Link>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/workspaces/from-session/${s.id}`}>Workspace</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
