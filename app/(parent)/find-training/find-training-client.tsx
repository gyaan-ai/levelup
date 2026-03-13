'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { MapPin, Calendar, Users, ChevronDown, Clock } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { SchoolLogo } from '@/components/school-logo';
import { SessionStatusPill } from '@/components/session-tile-utils';

type Facility = { id: string; name?: string; school?: string; address?: string | null };
type SessionRow = {
  id: string;
  scheduled_datetime: string;
  session_type: string | null;
  session_mode: string | null;
  join_policy?: string | null;
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

type CoachOption = { id: string; first_name?: string; last_name?: string; school?: string };

export function FindTrainingClient({
  facilities,
  initialSessions,
  initialDate,
  initialTime,
  initialLocation,
  initialCoach = '',
  coaches = [],
  searchBasePath = '/find-training',
  defaultRangeLabel,
}: {
  facilities: Facility[];
  initialSessions: SessionRow[];
  initialDate: string;
  initialTime: string;
  initialLocation: string;
  initialCoach?: string;
  coaches?: CoachOption[];
  searchBasePath?: string;
  /** e.g. "Next 7 days" — when set, show results without requiring date (smart default) */
  defaultRangeLabel?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState(initialTime || 'any');
  const [location, setLocation] = useState(initialLocation || 'all');
  const [coach, setCoach] = useState(initialCoach || 'all');
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  useEffect(() => {
    setDate(initialDate || '');
    setTime(initialTime || 'any');
    setLocation(initialLocation || 'all');
    setCoach(initialCoach || 'all');
  }, [initialDate, initialTime, initialLocation, initialCoach]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchBasePath === '/dashboard') params.set('tab', 'find-training');
    if (searchBasePath === '/training') params.set('tab', 'sessions');
    if (date) params.set('date', date);
    if (time && time !== 'any') params.set('time', time);
    if (location && location !== 'all') params.set('location', location);
    if (coach && coach !== 'all') params.set('coach', coach);
    router.push(`${searchBasePath}?${params.toString()}`);
  };

  const hasSearchCriteria = date || (location && location !== 'all') || (coach && coach !== 'all');
  const showResults = initialSessions.length > 0 && (hasSearchCriteria || !!defaultRangeLabel);
  const showNoResults = (hasSearchCriteria || !!defaultRangeLabel) && initialSessions.length === 0;

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
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="find-date"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal min-h-[44px] h-11',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {date
                      ? (() => {
                          const [y, m, d] = date.split('-').map(Number);
                          return formatEST(new Date(y, (m ?? 1) - 1, d ?? 1), 'EEE, MMM d, yyyy');
                        })()
                      : 'Pick a date'}
                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
                  <CalendarComponent
                    mode="single"
                    selected={date ? (() => {
                      const [y, m, d] = date.split('-').map(Number);
                      return new Date(y, (m ?? 1) - 1, d ?? 1);
                    })() : undefined}
                    defaultMonth={date ? (() => {
                      const [y, m] = date.split('-').map(Number);
                      return new Date(y ?? new Date().getFullYear(), (m ?? new Date().getMonth() + 1) - 1, 1);
                    })() : new Date()}
                    onSelect={(d) => {
                      if (d) {
                        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
                        setDate(`${y}-${m}-${day}`);
                        setDateOpen(false);
                      }
                    }}
                    disabled={(d) => d < startOfDay(new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="find-time">Time of day</Label>
              <Popover open={timeOpen} onOpenChange={setTimeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="find-time"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal min-h-[44px] h-11',
                      time === 'any' && 'text-muted-foreground'
                    )}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {time === 'any'
                      ? 'Any time'
                      : time === 'morning'
                        ? 'Morning (6am–12pm)'
                        : time === 'afternoon'
                          ? 'Afternoon (12pm–5pm)'
                          : 'Evening (5pm–9pm)'}
                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  {[
                    { value: 'any', label: 'Any time' },
                    { value: 'morning', label: 'Morning (6am–12pm)' },
                    { value: 'afternoon', label: 'Afternoon (12pm–5pm)' },
                    { value: 'evening', label: 'Evening (5pm–9pm)' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setTime(opt.value);
                        setTimeOpen(false);
                      }}
                      className={cn(
                        'w-full min-h-[44px] rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/20 focus:bg-accent/20 focus:outline-none',
                        time === opt.value && 'bg-accent/30 font-medium'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="find-location">Facility</Label>
              <Select
                value={location}
                onValueChange={setLocation}
              >
                <SelectTrigger id="find-location" className="min-h-[44px]">
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
            {coaches.length > 0 && (
              <div>
                <Label htmlFor="find-coach">Coach</Label>
                <Select
                  value={coach}
                  onValueChange={setCoach}
                >
                  <SelectTrigger id="find-coach" className="min-h-[44px]">
                    <SelectValue placeholder="Any coach" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any coach</SelectItem>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                          {c.school && <span className="text-muted-foreground">({c.school})</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

      {!showResults && !showNoResults ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Pick a date and click Search, or pick a location and click Search to see sessions.</p>
          </CardContent>
        </Card>
      ) : showNoResults ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{defaultRangeLabel ? `No open sessions ${defaultRangeLabel.toLowerCase()}.` : 'No open sessions for this search.'}</p>
            <p className="text-sm mt-2">Try another date or location.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Open sessions</CardTitle>
            <p className="text-sm text-muted-foreground">
              {initialSessions.length} session{initialSessions.length !== 1 ? 's' : ''}
              {date
                ? (() => { const [y, m, d] = date.split('-').map(Number); return ` on ${formatEST(new Date(y, m - 1, d), 'EEEE, MMM d, yyyy')}`; })()
                : defaultRangeLabel
                  ? ` · ${defaultRangeLabel}`
                  : ' at this location'}
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
                        {s.join_policy === 'invite_only' && (
                          <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded">
                            Invite only
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
                          <Link href={`/sessions/${s.id}/register`}>
                            {s.join_policy === 'invite_only' ? 'Get link / Register' : 'Register (pay & join)'}
                          </Link>
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
