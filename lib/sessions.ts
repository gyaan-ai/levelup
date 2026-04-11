import type { SessionMode } from '@/types';

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I to avoid confusion

/** Generate a unique 8-char invite code (caller should ensure uniqueness in DB) */
export function generateInviteCode(): string {
  let code = '';
  const arr = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 8; i++) {
    code += INVITE_CODE_CHARS[arr[i] % INVITE_CODE_CHARS.length];
  }
  return code;
}

export interface SessionPricing {
  oneOnOne: number;
  twoAthlete: number;
  groupRate: number;
}

/** Calculate price for a session based on mode and participant count */
export function getSessionPrice(
  sessionMode: SessionMode,
  numParticipants: number,
  pricing: SessionPricing
): { total: number; basePrice?: number; pricePerParticipant?: number } {
  switch (sessionMode) {
    case 'private':
      return { total: pricing.oneOnOne, basePrice: pricing.oneOnOne, pricePerParticipant: pricing.oneOnOne };
    case 'sibling':
      const perAthlete = pricing.twoAthlete / 2; // $40 per wrestler
      return {
        total: perAthlete * numParticipants,
        basePrice: undefined,
        pricePerParticipant: perAthlete,
      };
    case 'partner-invite':
    case 'partner-open':
      const partnerPer = pricing.twoAthlete / 2;
      return {
        total: partnerPer * Math.max(1, numParticipants),
        basePrice: undefined,
        pricePerParticipant: partnerPer,
      };
    default:
      return { total: pricing.oneOnOne, basePrice: pricing.oneOnOne, pricePerParticipant: pricing.oneOnOne };
  }
}

/** Check if a session can be joined (e.g. by invite code or open) - logic only; caller passes session row */
export function canJoinSession(
  session: { session_mode: string; current_participants: number; max_participants: number } | null
): boolean {
  if (!session) return false;
  if (session.session_mode !== 'partner-invite' && session.session_mode !== 'partner-open') return false;
  return session.current_participants < session.max_participants;
}

/** Create a notification (caller uses Supabase client with service role or RLS allows insert for user_id = auth.uid()) */
export type NotificationType =
  | 'join_request_received'
  | 'join_request_approved'
  | 'join_request_declined'
  | 'partner_24h_reminder';

export function createNotificationPayload(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  data: Record<string, unknown> = {}
): { user_id: string; type: string; title: string; body?: string; data: Record<string, unknown> } {
  return {
    user_id: userId,
    type,
    title,
    body: body ?? undefined,
    data: { ...data },
  };
}

/** Human-readable titles for notification types */
export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  join_request_received: 'Join request received for your session',
  join_request_approved: 'Your join request was approved',
  join_request_declined: 'Your join request was declined',
  partner_24h_reminder: '24 hours until your session - still need a partner?',
};

const TERMINAL_SESSION_STATUSES = new Set(['completed', 'cancelled', 'no-show']);

/**
 * Seats filled for capacity UI and gates. Uses the higher of `current_participants` and
 * actual roster rows (or `participantRowCountOverride` from a COUNT query) so we don't show
 * "2 spots left" when the counter drifted after a failed webhook, manual DB edits, or Stripe refunds.
 */
function participantRowCount(session: {
  session_participants?: unknown[] | null;
}, override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override)) return Math.max(0, override);
  const sp = session.session_participants;
  if (Array.isArray(sp)) return sp.length;
  return 0;
}

export function getEffectiveFilledCount(
  session: {
    current_participants?: number | null;
    max_participants?: number | null;
    session_participants?: unknown[] | null;
  },
  participantRowCountOverride?: number
): number {
  // Get count from session_participants rows if available
  const rows = participantRowCount(session, participantRowCountOverride);
  
  // Get count from current_participants column
  const fromColRaw = session.current_participants;
  const fromCol =
    typeof fromColRaw === 'number' && Number.isFinite(fromColRaw)
      ? fromColRaw
      : typeof fromColRaw === 'string'
        ? parseInt(fromColRaw, 10)
        : 0;
  const fromColSafe = Number.isFinite(fromCol) ? fromCol : 0;
  
  // Use the HIGHER of the two values to avoid showing wrong availability
  // This handles cases where:
  // - session_participants wasn't fetched (rows = 0, use fromCol)
  // - session_participants is empty array but current_participants has value (use fromCol)
  // - current_participants is stale/lower than actual roster (use rows)
  const effectiveCount = Math.max(rows, fromColSafe);
  
  const max = session.max_participants;
  if (max == null || max <= 0) return effectiveCount;
  return Math.min(effectiveCount, max);
}

/** Use when UI lists names from session_participants so the badge cannot stay behind the roster (stale current_participants column). */
export function getEffectiveFilledCountWithListedNames(
  session: {
    current_participants?: number | null;
    max_participants?: number | null;
    session_participants?: unknown[] | null;
  },
  listedNameCount: number,
  participantRowCountOverride?: number
): number {
  const base = getEffectiveFilledCount(session, participantRowCountOverride);
  const listed = Math.max(0, Math.floor(listedNameCount));
  const max = session.max_participants;
  const raw = Math.max(base, listed);
  if (max == null || max <= 0) return raw;
  return Math.min(raw, max);
}

/**
 * For Training / find-training lists: is this session bookable as "open" (has spots left)?
 * If max_participants is missing in DB, do not treat as max=1 (that wrongly marked multi-kid groups as full).
 */
export function isSessionOpenForParentBrowse(s: {
  status?: string | null;
  current_participants?: number | null;
  max_participants?: number | null;
  session_participants?: unknown[] | null;
}): boolean {
  if (TERMINAL_SESSION_STATUSES.has((s.status ?? '') as string)) return false;
  const max = s.max_participants;
  if (max == null || max <= 0) return true;
  const filled = getEffectiveFilledCount(s);
  return filled < max;
}

/** Past/cancelled or truly at capacity (requires valid max_participants). */
export function isSessionClosedForParentBrowse(s: {
  status?: string | null;
  current_participants?: number | null;
  max_participants?: number | null;
  session_participants?: unknown[] | null;
}): boolean {
  if (TERMINAL_SESSION_STATUSES.has((s.status ?? '') as string)) return true;
  const max = s.max_participants;
  if (max == null || max <= 0) return false;
  const filled = getEffectiveFilledCount(s);
  return filled >= max;
}
