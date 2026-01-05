import { Athlete } from '@/types';

export function isProfileComplete(athlete: Athlete | null): boolean {
  if (!athlete) return false;
  
  // Check required fields for a complete profile
  return !!(
    athlete.bio &&
    athlete.bio.trim().length > 0 &&
    athlete.photo_url &&
    athlete.photo_url.trim().length > 0
  );
}

