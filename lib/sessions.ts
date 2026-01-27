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
