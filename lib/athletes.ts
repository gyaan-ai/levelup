import { Athlete } from '@/types';

export function isProfileComplete(athlete: Athlete | null): boolean {
  if (!athlete) return false;
  
  // Check required fields for a complete profile
  // Bio is required, photo is optional (can be added later)
  return !!(
    athlete.bio &&
    athlete.bio.trim().length > 0
  );
}

const startOfToday = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

/** SafeSport badge: expiration date must be after today. */
export function isSafeSportValidForDisplay(athlete: Pick<Athlete, 'safesport_expiration'>): boolean {
  const exp = athlete.safesport_expiration;
  if (!exp) return false;
  const d = new Date(exp);
  if (Number.isNaN(d.getTime())) return false;
  return d > startOfToday();
}

/**
 * Background check badge: coach signup stores attestation in `background_check` and the *completion* date in
 * `background_check_expiration` (same column name as legacy "expiration" — do not require date > today).
 * Legacy rows: only a future date in `background_check_expiration` counts as valid if boolean is unset.
 */
export function isBackgroundCheckValidForDisplay(
  athlete: Pick<Athlete, 'background_check' | 'background_check_expiration'>
): boolean {
  if (athlete.background_check === true) return true;
  const exp = athlete.background_check_expiration;
  if (!exp) return false;
  const d = new Date(exp);
  if (Number.isNaN(d.getTime())) return false;
  return d > startOfToday();
}

