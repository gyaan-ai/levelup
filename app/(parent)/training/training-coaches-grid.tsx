'use client';

import { useMemo, useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { ProfileImage } from '@/components/profile-image';
import { SchoolLogo } from '@/components/school-logo';
import { StarRating } from '@/components/star-rating';
import { formatEST } from '@/lib/format-date';
import {
  coachIdsMatchingDateFilter,
  type CoachDateFilterData,
} from '@/lib/training-coach-date-filter';
import type { Athlete } from '@/types';
import { useAuth } from '@/lib/auth/use-auth';

type SessionTypeFilter = 'all' | 'small_group' | 'partner' | 'private';

export interface AthleteWithNext extends Athlete {
  nextAvailable?: { slot_date: string; start_time: string } | null;
}

type Props = {
  athletes: AthleteWithNext[];
  serviceTypesByCoach: Record<string, string[]>;
  coachIdsWithOpen: string[];
  preselectedWrestlerId?: string;
  locationFacilities: Array<{ id: string; name: string }>;
  coachIdsByFacilityId: Record<string, string[]>;
  coachDateFilterData: CoachDateFilterData;
  coachDateFilterBounds: { minYmd: string; maxYmd: string };
};

function formatCoachNextLine(slot_date: string, _start_time: string): string {
  const d = new Date(slot_date + 'T12:00:00');
  return `Next: ${formatEST(d, 'EEE MMM d')}`;
}

export function TrainingCoachesGrid({
  athletes,
  serviceTypesByCoach,
  coachIdsWithOpen,
  preselectedWrestlerId = '',
  locationFacilities,
  coachIdsByFacilityId,
  coachDateFilterData,
  coachDateFilterBounds,
}: Props) {
  const { user, userRole } = useAuth();
  const dateInputId = useId();
  const [followedCoachIds, setFollowedCoachIds] = useState<Set<string>>(new Set());
  const [facilityId, setFacilityId] = useState<string>('all');
  const [sessionType, setSessionType] = useState<SessionTypeFilter>('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [filterDate, setFilterDate] = useState<string>('');

  useEffect(() => {
    if (!user || (userRole !== 'parent' && userRole !== 'admin')) return;
    fetch('/api/coach-follows')
      .then((r) => r.json())
      .then((d) => {
        if (d.follows) {
          setFollowedCoachIds(new Set(d.follows.map((f: { coachId: string }) => f.coachId)));
        }
      })
      .catch(() => {});
  }, [user, userRole]);

  const allCoachIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const dateCoachSet = useMemo(
    () =>
      coachIdsMatchingDateFilter(
        filterDate || null,
        sessionType,
        coachDateFilterData,
        allCoachIds
      ),
    [filterDate, sessionType, coachDateFilterData, allCoachIds]
  );

  const filtered = useMemo(() => {
    const allowedByLocation =
      facilityId === 'all'
        ? null
        : new Set(coachIdsByFacilityId[facilityId] ?? []);

    return athletes.filter((a) => {
      if (allowedByLocation && !allowedByLocation.has(a.id)) return false;
      if (sessionType !== 'all') {
        const types = serviceTypesByCoach[a.id] ?? [];
        if (!types.includes(sessionType)) return false;
      }
      if (availableOnly && !coachIdsWithOpen.includes(a.id)) return false;
      if (dateCoachSet && !dateCoachSet.has(a.id)) return false;
      return true;
    });
  }, [
    athletes,
    facilityId,
    sessionType,
    availableOnly,
    serviceTypesByCoach,
    coachIdsWithOpen,
    coachIdsByFacilityId,
    dateCoachSet,
  ]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const af = followedCoachIds.has(a.id);
      const bf = followedCoachIds.has(b.id);
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      const ar = a.average_rating ?? 0;
      const br = b.average_rating ?? 0;
      if (br !== ar) return br - ar;
      return (b.review_count ?? 0) - (a.review_count ?? 0);
    });
    return copy;
  }, [filtered, followedCoachIds]);

  const profileHref = (id: string) =>
    preselectedWrestlerId
      ? `/athlete/${id}?youthWrestlerId=${encodeURIComponent(preselectedWrestlerId)}`
      : `/athlete/${id}`;

  const showDateEmpty = Boolean(filterDate) && sorted.length === 0;

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2 gap-y-3 pb-2"
        role="toolbar"
        aria-label="Coach filters"
      >
        <div className="flex shrink-0 items-center gap-2">
          {filterDate ? (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className="flex min-h-[44px] max-w-[11rem] items-center gap-1 rounded-full border border-[#D4AF37]/40 bg-zinc-900 px-3 py-2 text-sm font-medium text-[#D4AF37] touch-manipulation"
              aria-label={`Clear date filter ${formatEST(parseISO(`${filterDate}T12:00:00`), 'EEE MMM d')}`}
            >
              <span className="truncate">{formatEST(parseISO(`${filterDate}T12:00:00`), 'EEE MMM d')}</span>
              <span className="text-lg leading-none" aria-hidden>
                ×
              </span>
            </button>
          ) : (
            <div className="relative flex min-h-[44px] w-[11rem] shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 px-3 text-sm font-medium text-zinc-300 touch-manipulation [&:focus-within]:ring-2 [&:focus-within]:ring-[#D4AF37]/50">
              <span className="pointer-events-none select-none">Date</span>
              <input
                id={dateInputId}
                type="date"
                min={coachDateFilterBounds.minYmd}
                max={coachDateFilterBounds.maxYmd}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-full border-0 bg-transparent p-0 text-base opacity-[0.01] [color-scheme:dark]"
                aria-label="Filter coaches by date"
              />
            </div>
          )}
        </div>

        <label className="sr-only" htmlFor="training-coach-location">
          Location
        </label>
        <select
          id="training-coach-location"
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
          className="min-h-[44px] w-full min-w-[10rem] max-w-[min(100%,20rem)] shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50 sm:w-auto"
        >
          <option value="all">All locations</option>
          {locationFacilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'All'],
              ['small_group', 'Small Group'],
              ['partner', 'Partner'],
              ['private', 'Private'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSessionType(val)}
              className={`min-h-[44px] shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                sessionType === val
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAvailableOnly((v) => !v)}
          aria-pressed={availableOnly}
          title="Coaches with upcoming open sessions only"
          className={`min-h-[44px] shrink-0 self-center whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
            availableOnly
              ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
              : 'bg-zinc-900 text-zinc-300 border-zinc-800'
          }`}
        >
          Available
        </button>
      </div>

      {showDateEmpty ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center">
          <p className="text-sm text-zinc-300">
            No coaches available on {formatEST(parseISO(`${filterDate}T12:00:00`), 'EEE MMM d')} — try another day
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-[44px] w-full max-w-sm border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
            onClick={() => setFilterDate('')}
          >
            Clear date filter
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {sorted.map((a) => {
          const isFollowed = followedCoachIds.has(a.id);
          const next = a.nextAvailable;
          const nextLabel = next
            ? formatCoachNextLine(next.slot_date, next.start_time)
            : 'No upcoming sessions';
          return (
            <div
              key={a.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden flex flex-col"
            >
              <Link href={profileHref(a.id)} className="block aspect-square w-full bg-zinc-800 overflow-hidden rounded-t-xl">
                <ProfileImage
                  src={a.photo_url}
                  alt={`${a.first_name} ${a.last_name}`}
                  focusX={a.photo_focus_x ?? 50}
                  focusY={a.photo_focus_y ?? 15}
                  rounded="lg"
                  className="w-full h-full min-h-[140px] object-cover rounded-none"
                  fallbackIconClassName="h-16 w-16 text-muted-foreground"
                />
              </Link>
              <div className="p-3 flex flex-col flex-1 gap-2 min-h-0">
                <Link href={profileHref(a.id)} className="font-semibold text-foreground text-sm leading-tight hover:underline">
                  {a.first_name} {a.last_name}
                </Link>
                <div className="flex items-center gap-1 flex-wrap text-xs text-zinc-500">
                  {a.school && <SchoolLogo school={a.school} size="sm" />}
                  <span className="truncate">{a.school}</span>
                  {a.weight_class && <span>· {a.weight_class} lbs</span>}
                  {a.year && <span>· {a.year}</span>}
                </div>
                <StarRating averageRating={a.average_rating} reviewCount={a.review_count} size="sm" />
                <p className="text-xs text-zinc-400 mt-auto line-clamp-2">{nextLabel}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <TrainingFollowHeart coachId={a.id} isFollowed={isFollowed} onFollowChange={setFollowedCoachIds} />
                  <Button variant="outline" size="sm" className="min-h-[44px] text-xs px-2" asChild>
                    <Link href={profileHref(a.id)}>View</Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrainingFollowHeart({
  coachId,
  isFollowed,
  onFollowChange,
}: {
  coachId: string;
  isFollowed: boolean;
  onFollowChange: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const { user, userRole } = useAuth();
  const [following, setFollowing] = useState(isFollowed);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFollowing(isFollowed);
  }, [isFollowed]);

  if (!user || (userRole !== 'parent' && userRole !== 'admin')) {
    return (
      <Button variant="outline" size="sm" className="min-h-[44px] text-xs px-1" disabled>
        <Heart className="h-4 w-4" />
      </Button>
    );
  }

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (following) {
        const r = await fetch(`/api/coach-follows?coachId=${encodeURIComponent(coachId)}`, { method: 'DELETE' });
        if (r.ok) {
          setFollowing(false);
          onFollowChange((prev) => {
            const n = new Set(prev);
            n.delete(coachId);
            return n;
          });
        }
      } else {
        const r = await fetch('/api/coach-follows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachId }),
        });
        if (r.ok) {
          setFollowing(true);
          onFollowChange((prev) => new Set(prev).add(coachId));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={following ? 'default' : 'outline'}
      size="sm"
      className={`min-h-[44px] text-xs px-2 ${following ? 'bg-[#D4AF37] hover:bg-[#c9a432] text-black border-0' : ''}`}
      onClick={toggle}
      disabled={loading}
    >
      <Heart className={`h-4 w-4 mr-1 ${following ? 'fill-current' : ''}`} />
      Follow
    </Button>
  );
}
