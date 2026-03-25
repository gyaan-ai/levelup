'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { MapPin, Calendar, Users, Clock, ShoppingCart, Check, ChevronRight, Filter, X } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatEST } from '@/lib/format-date';
import { startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { SchoolLogo } from '@/components/school-logo';
import { StarRating } from '@/components/star-rating';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { ProfileImage } from '@/components/profile-image';
import {
  getEffectiveFilledCount,
  isSessionOpenForParentBrowse,
} from '@/lib/sessions';

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
  session_participants?: Array<{
    id?: string;
    youth_wrestler_id?: string | null;
    roster_first_name?: string | null;
    roster_last_name?: string | null;
    roster_photo_url?: string | null;
    youth_wrestlers?: { id: string; first_name?: string; last_name?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; photo_url?: string }[] | null;
  } | null>;
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
  defaultRangeLabel?: string;
  preselectedWrestlerId?: string;
}) {
  const router = useRouter();
  const { addItem, removeItem, isInCart } = useCart();
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState(initialTime || 'any');
  const [location, setLocation] = useState(initialLocation || 'all');
  const [coach, setCoach] = useState(initialCoach || 'all');
  const [dateOpen, setDateOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setDate(initialDate || '');
    setTime(initialTime || 'any');
    setLocation(initialLocation || 'all');
    setCoach(initialCoach || 'all');
  }, [initialDate, initialTime, initialLocation, initialCoach]);

  // Show all sessions - don't filter by open status, let users see full sessions too
  const openSessions = initialSessions;

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (searchBasePath === '/dashboard') params.set('tab', 'find-training');
    if (searchBasePath === '/training') params.set('tab', 'sessions');
    if (date) params.set('date', date);
    if (time && time !== 'any') params.set('time', time);
    if (location && location !== 'all') params.set('location', location);
    if (coach && coach !== 'all') params.set('coach', coach);
    router.push(`${searchBasePath}?${params.toString()}`);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDate('');
    setTime('any');
    setLocation('all');
    setCoach('all');
    router.push(searchBasePath);
  };

  const hasActiveFilters = date || time !== 'any' || location !== 'all' || coach !== 'all';
  const activeFilterCount = [date, time !== 'any', location !== 'all', coach !== 'all'].filter(Boolean).length;

  // Filter pills data
  const timeOptions = [
    { value: 'any', label: 'Any time' },
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' },
  ];

  const SessionCard = ({ session }: { session: SessionRow }) => {
    const coachData = Array.isArray(session.athletes) ? session.athletes[0] : session.athletes;
    const facilityData = Array.isArray(session.facilities) ? session.facilities[0] : session.facilities;
    const dt = new Date(session.scheduled_datetime);
    const max = session.max_participants ?? 1;
    const current = getEffectiveFilledCount(session);
    const openSlots = Math.max(0, max - current);
    const price = session.price_per_participant;
    const inCart = isInCart(session.id);

    const handleAddToCart = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (inCart) {
        removeItem(session.id);
      } else {
        addItem({
          id: session.id,
          scheduled_datetime: session.scheduled_datetime,
          session_type: session.session_type,
          price_per_participant: session.price_per_participant,
          coach_name: coachData ? [coachData.first_name, coachData.last_name].filter(Boolean).join(' ') : 'Coach',
          coach_id: coachData?.id ?? session.athlete_id,
          facility_name: facilityData?.name ?? '',
        });
      }
    };

    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 hover:border-zinc-700 transition-all">
        <div className="flex gap-4">
          {/* Coach Photo */}
          <Link href={`/athlete/${coachData?.id ?? session.athlete_id}`} className="shrink-0">
            <ProfileImage
              src={coachData?.photo_url}
              alt={coachData ? `${coachData.first_name} ${coachData.last_name}` : 'Coach'}
              className="w-14 h-14 rounded-full"
              fallbackIconClassName="h-6 w-6 text-muted-foreground"
            />
          </Link>

          {/* Session Info */}
          <div className="flex-1 min-w-0">
            {/* Type & Focus & Join Policy */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <SessionTypeBadge sessionType={session.session_type} sessionMode={session.session_mode} />
              {(session as { join_policy?: string | null }).join_policy === 'invite_only' ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400 border border-amber-700/50">
                  Invite Only
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-700/50">
                  Open
                </span>
              )}
              {session.focus_area && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  {session.focus_area}
                </span>
              )}
            </div>

            {/* Date & Time */}
            <p className="font-semibold text-foreground">
              {formatEST(dt, 'EEE, MMM d')} · {formatEST(dt, 'h:mm a')}
            </p>

            {/* Coach Info */}
            <div className="flex items-center gap-2 mt-1">
              <Link 
                href={`/athlete/${coachData?.id ?? session.athlete_id}`}
                className="text-sm text-zinc-300 hover:text-foreground transition-colors"
              >
                {coachData ? `${coachData.first_name} ${coachData.last_name}` : 'Coach'}
              </Link>
              {coachData?.school && (
                <SchoolLogo school={coachData.school} size="sm" />
              )}
              {coachData && (
                <StarRating
                  averageRating={coachData.average_rating}
                  reviewCount={coachData.review_count}
                  size="sm"
                />
              )}
            </div>

            {/* Location & Spots */}
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
              {facilityData && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {facilityData.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {openSlots > 0 ? `${openSlots} spot${openSlots !== 1 ? 's' : ''} left` : 'Full'}
              </span>
            </div>
          </div>

          {/* Price & Action */}
          <div className="flex flex-col items-end justify-between shrink-0">
            {price != null && price > 0 && (
              <span className="text-lg font-bold text-foreground">${price}</span>
            )}
            {openSlots > 0 ? (
              <Button
                size="sm"
                onClick={handleAddToCart}
                className={cn(
                  "min-h-[36px] gap-1.5 transition-all",
                  inCart 
                    ? "bg-zinc-800 hover:bg-zinc-700 text-[#D4AF37] border border-[#D4AF37]/30"
                    : "bg-[#D4AF37] hover:bg-[#B8963C] text-black"
                )}
              >
                {inCart ? (
                  <>
                    <Check className="h-4 w-4" />
                    Added
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Add
                  </>
                )}
              </Button>
            ) : (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">Full</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {/* Date Picker */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                date
                  ? "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <Calendar className="h-4 w-4" />
              {date ? formatEST(new Date(date + 'T12:00:00'), 'MMM d') : 'Date'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={date ? new Date(date + 'T12:00:00') : undefined}
              onSelect={(d) => {
                if (d) {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setDate(`${y}-${m}-${day}`);
                  setDateOpen(false);
                  // Auto-apply filter
                  const params = new URLSearchParams();
                  if (searchBasePath === '/training') params.set('tab', 'sessions');
                  params.set('date', `${y}-${m}-${day}`);
                  if (time !== 'any') params.set('time', time);
                  if (location !== 'all') params.set('location', location);
                  if (coach !== 'all') params.set('coach', coach);
                  router.push(`${searchBasePath}?${params.toString()}`);
                }
              }}
              disabled={(d) => d < startOfDay(new Date())}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Time Pills */}
        {timeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setTime(opt.value);
              const params = new URLSearchParams();
              if (searchBasePath === '/training') params.set('tab', 'sessions');
              if (date) params.set('date', date);
              if (opt.value !== 'any') params.set('time', opt.value);
              if (location !== 'all') params.set('location', location);
              if (coach !== 'all') params.set('coach', coach);
              router.push(`${searchBasePath}?${params.toString()}`);
            }}
            className={cn(
              "px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
              time === opt.value
                ? "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
            )}
          >
            {opt.label}
          </button>
        ))}

        {/* More Filters Button */}
        <button
          onClick={() => setShowFilters(true)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
            (location !== 'all' || coach !== 'all')
              ? "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30"
              : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-[#D4AF37] text-black text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-zinc-300 whitespace-nowrap"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {/* Filter Sheet/Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setShowFilters(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-zinc-800 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Location Filter */}
            <div className="mb-6">
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Facility</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setLocation('all')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm transition-all",
                    location === 'all' ? "bg-[#D4AF37] text-black" : "bg-zinc-800 text-zinc-300"
                  )}
                >
                  All locations
                </button>
                {facilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setLocation(f.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm transition-all",
                      location === f.id ? "bg-[#D4AF37] text-black" : "bg-zinc-800 text-zinc-300"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach Filter */}
            {coaches.length > 0 && (
              <div className="mb-6">
                <label className="text-sm font-medium text-zinc-400 mb-2 block">Coach</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCoach('all')}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm transition-all",
                      coach === 'all' ? "bg-[#D4AF37] text-black" : "bg-zinc-800 text-zinc-300"
                    )}
                  >
                    Any coach
                  </button>
                  {coaches.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCoach(c.id)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm transition-all",
                        coach === c.id ? "bg-[#D4AF37] text-black" : "bg-zinc-800 text-zinc-300"
                      )}
                    >
                      {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Apply Button */}
            <Button 
              onClick={applyFilters}
              className="w-full bg-[#D4AF37] hover:bg-[#B8963C] text-black font-medium h-12"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {openSessions.length} session{openSessions.length !== 1 ? 's' : ''} available
          {defaultRangeLabel && !date && <span className="text-zinc-500"> · {defaultRangeLabel}</span>}
        </p>
      </div>

      {/* Sessions List */}
      {openSessions.length > 0 ? (
        <div className="space-y-3">
          {openSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
<div className="py-16 text-center">
  <Calendar className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
  <p className="text-zinc-400 mb-2">No sessions available</p>
  <p className="text-sm text-zinc-500">
  {hasActiveFilters ? 'Try adjusting your filters' : 'Check back later for new sessions'}
  </p>
  <p className="text-xs text-zinc-600 mt-4">Debug: received {initialSessions.length} sessions from server</p>
        </div>
      )}
    </div>
  );
}
