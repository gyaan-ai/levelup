import type { SupabaseClient } from '@supabase/supabase-js';

/** Statuses that reserve the coach's calendar (must not overlap each other). */
const COACH_CALENDAR_BLOCKING_STATUSES = ['scheduled'] as const;

const DEFAULT_SESSION_DURATION_MIN = 60;

/**
 * How far before the proposed start we load existing sessions (session start times).
 * Must exceed max realistic duration so a long session starting earlier still overlaps checks.
 */
const OVERLAP_START_LOOKBACK_MS = 24 * 60 * 60 * 1000;

function sessionIntervalEndMs(scheduledIso: string, durationMinutes: number | null | undefined): number {
  const start = new Date(scheduledIso).getTime();
  if (Number.isNaN(start)) return NaN;
  const dm =
    durationMinutes != null && Number.isFinite(Number(durationMinutes)) && Number(durationMinutes) > 0
      ? Number(durationMinutes)
      : DEFAULT_SESSION_DURATION_MIN;
  return start + dm * 60_000;
}

/** Half-open [start, end): overlap iff aStart < bEnd && bStart < aEnd */
export function intervalsOverlapHalfOpen(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type CoachSessionOverlapConflict = {
  conflictingSessionId: string;
  scheduledDatetime: string;
};

export const COACH_SESSION_OVERLAP_ERROR =
  'That time is not available — this coach already has another session then. Choose a different time that does not overlap.';

/**
 * Same coach (`athlete_id`): no overlapping session windows. Facility is not part of the check.
 */
export async function findCoachSessionTimeOverlap(
  admin: SupabaseClient,
  args: {
    coachAthleteId: string;
    scheduledStartIso: string;
    durationMinutes: number | null | undefined;
    excludeSessionId?: string | null;
  }
): Promise<CoachSessionOverlapConflict | null> {
  const { coachAthleteId, scheduledStartIso, durationMinutes, excludeSessionId } = args;
  const proposedStart = new Date(scheduledStartIso).getTime();
  const proposedEnd = sessionIntervalEndMs(scheduledStartIso, durationMinutes);
  if (Number.isNaN(proposedStart) || Number.isNaN(proposedEnd)) return null;

  const lowerStartBound = new Date(proposedStart - OVERLAP_START_LOOKBACK_MS).toISOString();
  const upperStartBound = new Date(proposedEnd).toISOString();

  const { data: rows, error } = await admin
    .from('sessions')
    .select('id, scheduled_datetime, duration_minutes')
    .eq('athlete_id', coachAthleteId)
    .in('status', [...COACH_CALENDAR_BLOCKING_STATUSES])
    .gte('scheduled_datetime', lowerStartBound)
    .lt('scheduled_datetime', upperStartBound);

  if (error) {
    console.error('[findCoachSessionTimeOverlap]', error);
    throw new Error(error.message);
  }

  for (const row of rows ?? []) {
    if (excludeSessionId && row.id === excludeSessionId) continue;
    const bStart = new Date(row.scheduled_datetime).getTime();
    const bEnd = sessionIntervalEndMs(row.scheduled_datetime, row.duration_minutes);
    if (Number.isNaN(bStart) || Number.isNaN(bEnd)) continue;
    if (intervalsOverlapHalfOpen(proposedStart, proposedEnd, bStart, bEnd)) {
      return { conflictingSessionId: row.id, scheduledDatetime: row.scheduled_datetime };
    }
  }
  return null;
}
