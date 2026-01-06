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

