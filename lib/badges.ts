/**
 * Session badges: same tiers for coaches and youth athletes.
 * Based on completed sessions only. Neutral labels (platform activity, not skill).
 */
export const SESSION_BADGE_TIERS = [0, 10, 25, 50, 100] as const;
export type SessionBadgeTier = (typeof SESSION_BADGE_TIERS)[number];

export interface SessionBadgeInfo {
  tier: SessionBadgeTier;
  label: string;
}

/** Get badge tier and label from completed session count. Everyone gets a badge (0 = "New"). */
export function getSessionBadge(completedCount: number): SessionBadgeInfo {
  const n = Math.max(0, Math.floor(completedCount));
  if (n >= 100) return { tier: 100, label: '100' };
  if (n >= 50) return { tier: 50, label: '50' };
  if (n >= 25) return { tier: 25, label: '25' };
  if (n >= 10) return { tier: 10, label: '10' };
  return { tier: 0, label: 'New' };
}
