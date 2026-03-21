/** Fields stored on session_participants so roster lists work under youth_wrestlers RLS. */
export type SessionRosterSnapshot = {
  roster_first_name: string | null;
  roster_last_name: string | null;
  roster_photo_url: string | null;
};

export function rosterSnapshotFromYouthRow(yw: {
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
}): SessionRosterSnapshot {
  return {
    roster_first_name: yw.first_name ?? null,
    roster_last_name: yw.last_name ?? null,
    roster_photo_url: yw.photo_url ?? null,
  };
}
