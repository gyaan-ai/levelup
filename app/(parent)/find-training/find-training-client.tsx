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
import { MapPin, Calendar, Users, ChevronDown, Clock, Star } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { SchoolLogo } from '@/components/school-logo';
import { SessionStatusPill } from '@/components/session-tile-utils';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { ProfileImage } from '@/components/profile-image';

type Facility = { id: string; name?: string; school?: string; address?: string | null };
type SessionRow = {
  id: string;
  scheduled_datetime: string;
  status?: string | null;
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
  athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string; average_rating?: number | null; review_count?: number | null } | null;
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
  preselectedWrestlerId = '',
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
  /** Preselect this wrestler on the register page (e.g. from Book again) */
  preselectedWrestlerId?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState(initialTime || 'any');
  const [location, setLocation] = useState(initialLocation || 'all');
  const [coach, setCoach] = useState(initialCoach || 'all');
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [sessionsTab, setSessionsTab] = useState<'open' | 'closed'>('open');

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

  const closedStatuses = ['completed', 'cancelled', 'no-show'];
  const openSessions = initialSessions.filter((s) => {
    if (closedStatuses.includes((s.status ?? '') as string)) return false;
    return (s.current_participants ?? 0) < (s.max_participants ?? 1);
  });
  const closedSessions = initialSessions.filter((s) => {
    const atCapacity = (s.current_participants ?? 0) >= (s.max_participants ?? 1);
    return closedStatuses.includes((s.status ?? '') as string) || atCapacity;
  });
  const displayedSessions = sessionsTab === 'open' ? openSessions : closedSessions;

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
                <PopoverContent
                  className="z-[100] w-auto max-w-[min(100vw-2rem,360px)] max-h-[85vh] overflow-auto p-0 border border-border shadow-xl rounded-lg bg-card text-card-foreground"
                  align="start"
                  side="bottom"
                  sideOffset={8}
                  collisionPadding={16}
                  avoidCollisions
                >
                  <div className="p-2 bg-card text-card-foreground rounded-lg">
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
                      className="rounded-md"
                    />
                  </div>
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Sessions</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {date
                    ? (() => { const [y, m, d] = date.split('-').map(Number); return formatEST(new Date(y, m - 1, d), 'EEEE, MMM d, yyyy'); })()
                    : defaultRangeLabel ?? 'Select date or location'}
                </p>
              </div>
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setSessionsTab('open')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    sessionsTab === 'open'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Open sessions ({openSessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionsTab('closed')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    sessionsTab === 'closed'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Closed (at capacity) ({closedSessions.length})
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayedSessions.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {sessionsTab === 'open'
                    ? 'No open sessions for this search.'
                    : 'No closed sessions for this search.'}
                </p>
              ) : (
              displayedSessions.map((s) => {
                const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
                const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
                const current = s.current_participants ?? 0;
                const max = s.max_participants ?? 1;
                const dt = new Date(s.scheduled_datetime);
                const openSlots = max - current;

                return (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="flex gap-3 min-w-0 flex-1">
                      <ProfileImage
                        src={(coach as { photo_url?: string })?.photo_url}
                        alt={coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') : 'Coach'}
                        className="w-12 h-12 shrink-0 rounded-full object-cover border border-border"
                        fallbackIconClassName="h-6 w-6 text-muted-foreground"
                      />
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SessionTypeBadge sessionType={s.session_type} sessionMode={s.session_mode} />
                        <SessionStatusPill current={current} max={max} />
                        {s.join_policy === 'invite_only' && (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5">
                            Invite only
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-foreground">
                        {formatEST(dt, 'EEE, MMM d')} · {formatEST(dt, 'h:mm a')}
                        {coach && (
                          <span className="font-normal text-muted-foreground ml-1">
                            ·{' '}
                            <Link href={`/athlete/${coach.id}`} className="hover:underline text-foreground">
                              {[coach.first_name, coach.last_name].filter(Boolean).join(' ')}
                            </Link>
                            {coach.school && <SchoolLogo school={coach.school} size="sm" className="ml-1 inline" />}
                            {' · '}
                            <Link href={`/athlete/${coach.id}`} className="text-xs text-accent hover:underline">
                              Profile
                            </Link>
                          </span>
                        )}
                      </p>
                      {coach && (
                        <div className="flex items-center gap-1.5 text-sm flex-wrap">
                          {(() => {
                            const c = coach as { average_rating?: number | null; review_count?: number | null };
                            const avg = c.average_rating ?? 0;
                            const displayRating = avg > 0 ? avg.toFixed(1) : 'New';
                            const reviewCount = c.review_count ?? 0;
                            return (
                              <>
                                <div className="flex gap-0.5" aria-label={avg > 0 ? `${displayRating} out of 5 stars` : 'No reviews yet'}>
                                  {[1, 2, 3, 4, 5].map((i) => (
                                    <Star
                                      key={i}
                                      className={`h-3.5 w-3.5 ${i <= Math.round(avg) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
                                    />
                                  ))}
                                </div>
                                <span className="font-medium text-foreground">{displayRating}</span>
                                {reviewCount > 0 && (
                                  <span className="text-muted-foreground">
                                    ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {fac && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {fac.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {s.focus_area && <span>{s.focus_area} · </span>}
                        <span>{current}/{max} participants</span>
                        {s.price_per_participant != null && (
                          <span> · ${Number(s.price_per_participant).toFixed(2)}/person</span>
                        )}
                      </p>
                    </div>
                    </div>
                    <div className="shrink-0 flex flex-col sm:items-end gap-2">
                      {openSlots > 0 ? (
                        <Button asChild size="sm" className="min-h-[40px]">
                          <Link href={`/sessions/${s.id}/register${preselectedWrestlerId ? `?wrestler=${encodeURIComponent(preselectedWrestlerId)}` : ''}`}>
                            {s.join_policy === 'invite_only' ? 'Get link' : 'Book'}
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">At capacity</span>
                      )}
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
