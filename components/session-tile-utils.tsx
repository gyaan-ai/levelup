'use client';

import { User } from 'lucide-react';
import { ProfileImage } from '@/components/profile-image';

export type SessionAvailability = 'open' | 'filling' | 'full';

export function getSessionAvailability(
  current: number,
  max: number
): SessionAvailability {
  if (max <= 0) return 'open';
  if (current >= max) return 'full';
  const openSlots = max - current;
  const ratio = current / max;
  if (ratio >= 2 / 3 || openSlots <= 1) return 'filling';
  return 'open';
}

export function SessionStatusPill({
  current,
  max,
  className = '',
}: {
  current: number;
  max: number;
  className?: string;
}) {
  const status = getSessionAvailability(current, max);
  const label =
    status === 'open'
      ? 'Open'
      : status === 'filling'
        ? 'Filling up'
        : 'Closed';
  const bg =
    status === 'open'
      ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40'
      : status === 'filling'
        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40'
        : 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40';
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${bg} ${className}`}
      title={
        status === 'open'
          ? 'Open spots'
          : status === 'filling'
            ? 'Filling up'
            : 'Session full'
      }
    >
      {label}
    </span>
  );
}

export type ParticipantInfo = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
};

export function ParticipantAvatars({
  participants,
  maxShow = 5,
  size = 'sm',
  className = '',
}: {
  participants: ParticipantInfo[];
  maxShow?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const list = participants.slice(0, maxShow);
  const px = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  if (list.length === 0) {
    return (
      <div className={`flex -space-x-2 ${className}`}>
        <div
          className={`${px} rounded-full border-2 border-background bg-muted flex items-center justify-center flex-shrink-0`}
        >
          <User className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex -space-x-2 ${className}`}>
      {list.map((p) => (
        <div
          key={p.id}
          className={`${px} rounded-full border-2 border-background flex-shrink-0 overflow-hidden ring-1 ring-background`}
          title={[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Participant'}
        >
          <ProfileImage
            src={p.photo_url}
            alt={[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Participant'}
            className="w-full h-full"
            fallbackIconClassName={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'}
          />
        </div>
      ))}
      {participants.length > maxShow && (
        <div
          className={`${px} rounded-full border-2 border-background bg-muted flex items-center justify-center flex-shrink-0 ${textSize} font-medium`}
        >
          +{participants.length - maxShow}
        </div>
      )}
    </div>
  );
}
