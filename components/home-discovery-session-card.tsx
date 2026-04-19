'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShoppingCart, MapPin, Clock, Users } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatEST } from '@/lib/format-date';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { ProfileImage } from '@/components/profile-image';
import { SchoolLogo } from '@/components/school-logo';
import { StarRating } from '@/components/star-rating';
import { getEffectiveFilledCount, isSessionOpenForParentBrowse } from '@/lib/sessions';

export type DiscoverySession = {
  id: string;
  scheduled_datetime: string;
  session_type: string | null;
  session_mode: string | null;
  join_policy?: string | null;
  current_participants: number | null;
  max_participants: number | null;
  price_per_participant: number | null;
  duration_minutes?: number | null;
  athlete_id: string;
  athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string; average_rating?: number | null; review_count?: number | null } | null;
  facilities?: { id: string; name?: string } | null;
};

type Props = {
  session: DiscoverySession;
  parentWrestlerIds: string[];
};

export function HomeDiscoverySessionCard({ session, parentWrestlerIds }: Props) {
  const router = useRouter();
  const { addItem, sessionLineCount } = useCart();
  const coach = Array.isArray(session.athletes) ? session.athletes[0] : session.athletes;
  const facility = Array.isArray(session.facilities) ? session.facilities[0] : session.facilities;
  const dt = new Date(session.scheduled_datetime);
  const max = session.max_participants ?? 1;
  const current = getEffectiveFilledCount(session as Parameters<typeof getEffectiveFilledCount>[0]);
  const openSlots = Math.max(0, max - current);
  const price = session.price_per_participant;
  const duration = session.duration_minutes;
  const cartQty = sessionLineCount(session.id);
  const maxCartQty = Math.min(openSlots, parentWrestlerIds.length >= 1 ? parentWrestlerIds.length : 1);

  if (!isSessionOpenForParentBrowse(session)) return null;

  const handleAdd = () => {
    const wid = parentWrestlerIds[0];
    if (!wid) {
      router.push('/wrestlers/add');
      return;
    }
    if (cartQty >= maxCartQty) return;
    addItem({
      lineId: crypto.randomUUID(),
      id: session.id,
      scheduled_datetime: session.scheduled_datetime,
      session_type: session.session_type,
      price_per_participant: session.price_per_participant,
      coach_name: coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ').trim() : 'Coach',
      coach_id: session.athlete_id,
      facility_name: facility?.name ?? '',
      athlete_id: wid,
    });
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex gap-3">
        <ProfileImage
          src={coach?.photo_url}
          alt={coach ? `${coach.first_name} ${coach.last_name}` : 'Coach'}
          className="w-14 h-14 rounded-full shrink-0"
          fallbackIconClassName="h-6 w-6 text-muted-foreground"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SessionTypeBadge sessionType={session.session_type ?? null} sessionMode={session.session_mode ?? null} />
          </div>
          <Link href={`/athlete/${session.athlete_id}`} className="font-semibold text-foreground hover:underline block truncate">
            {coach ? `${coach.first_name} ${coach.last_name}` : 'Coach'}
          </Link>
          {coach?.school && <SchoolLogo school={coach.school} size="sm" className="mt-0.5" />}
          {coach ? (
            <div className="mt-1">
              <StarRating averageRating={coach.average_rating} reviewCount={coach.review_count} size="sm" />
            </div>
          ) : null}
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground">
        {formatEST(dt, 'EEE, MMM d')} · {formatEST(dt, 'h:mm a')}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
        {facility?.name && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {facility.name}
          </span>
        )}
        {duration != null && duration > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            {duration} min
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3 shrink-0" />
          {openSlots} spot{openSlots !== 1 ? 's' : ''} left
        </span>
      </div>
      {price != null && price > 0 && <p className="text-sm font-medium text-foreground">${price}</p>}
      <Button
        type="button"
        className="w-full min-h-[44px] bg-[#D4AF37] hover:bg-[#c9a432] text-black font-semibold"
        onClick={handleAdd}
        disabled={openSlots <= 0 || cartQty >= maxCartQty}
      >
        <ShoppingCart className="h-4 w-4 mr-2 shrink-0" />
        Add to Cart
      </Button>
    </div>
  );
}
