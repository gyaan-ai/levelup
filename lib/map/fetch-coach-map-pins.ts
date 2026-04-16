import { createAdminClient } from '@/lib/supabase/admin';
import { isSessionOpenForParentBrowse } from '@/lib/sessions';

export type SessionKind = 'private' | 'partner' | 'small_group';

export type CoachMapPin = {
  pinKey: string;
  coachId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  school: string;
  year: string | null;
  weightClass: string | null;
  averageRating: number | null;
  reviewCount: number;
  facilityId: string;
  facilityName: string;
  facilityAddress: string | null;
  latitude: number;
  longitude: number;
  nextSessionAt: string | null;
  sessionKinds: SessionKind[];
  hasOpenSession: boolean;
};

function normalizeSessionKind(sessionType: string | null | undefined): SessionKind | null {
  if (!sessionType) return null;
  const t = sessionType.toLowerCase();
  if (t === '1-on-1' || t === 'private') return 'private';
  if (t === '2-athlete' || t === 'partner') return 'partner';
  if (t === 'group' || t === 'small_group') return 'small_group';
  return null;
}

function coachHasOpenUpcomingSession(
  rows: Array<{
    status?: string | null;
    scheduled_datetime?: string;
    join_policy?: string | null;
    current_participants?: number | null;
    max_participants?: number | null;
    session_participants?: unknown[] | null;
  }>
): boolean {
  const now = Date.now();
  for (const s of rows) {
    if (!s.scheduled_datetime) continue;
    if (new Date(s.scheduled_datetime).getTime() <= now) continue;
    if (!isSessionOpenForParentBrowse(s)) continue;
    const jp = s.join_policy ?? '';
    if (jp !== 'public' && jp !== 'invite_only') continue;
    return true;
  }
  return false;
}

export async function fetchCoachMapPins(
  tenantSlug: string
): Promise<{ ok: true; pins: CoachMapPin[]; cities: string[] } | { ok: false; error: string }> {
  const admin = createAdminClient(tenantSlug);

  const { data: facilities, error: facErr } = await admin
    .from('facilities')
    .select('id, name, address, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (facErr) {
    console.error('[fetchCoachMapPins] facilities', facErr);
    return { ok: false, error: 'Failed to load facilities' };
  }

  const facilityIds = new Set((facilities ?? []).map((f) => f.id));
  if (facilityIds.size === 0) {
    return { ok: true, pins: [], cities: [] };
  }

  const { data: coaches, error: coachErr } = await admin
    .from('athletes')
    .select(
      'id, first_name, last_name, photo_url, school, year, weight_class, average_rating, review_count, facility_id, secondary_facility_id'
    )
    .eq('active', true)
    .eq('status', 'active');

  if (coachErr) {
    console.error('[fetchCoachMapPins] athletes', coachErr);
    return { ok: false, error: 'Failed to load coaches' };
  }

  const coachIds: string[] = [];
  for (const c of coaches ?? []) {
    const primary = c.facility_id && facilityIds.has(c.facility_id);
    const secondary = c.secondary_facility_id && facilityIds.has(c.secondary_facility_id);
    if (primary || secondary) coachIds.push(c.id as string);
  }

  const sessionByCoach = new Map<
    string,
    Array<{
      session_type: string | null;
      scheduled_datetime: string;
      status: string | null;
      join_policy: string | null;
      current_participants: number | null;
      max_participants: number | null;
    }>
  >();

  if (coachIds.length > 0) {
    const { data: sessions, error: sessErr } = await admin
      .from('sessions')
      .select(
        'athlete_id, session_type, scheduled_datetime, status, join_policy, current_participants, max_participants'
      )
      .in('athlete_id', coachIds)
      .in('status', ['scheduled', 'pending_payment'])
      .gt('scheduled_datetime', new Date().toISOString());

    if (sessErr) {
      console.error('[fetchCoachMapPins] sessions', sessErr);
    } else {
      for (const s of sessions ?? []) {
        const aid = s.athlete_id as string;
        const list = sessionByCoach.get(aid) ?? [];
        list.push({
          session_type: s.session_type as string | null,
          scheduled_datetime: s.scheduled_datetime as string,
          status: s.status as string | null,
          join_policy: s.join_policy as string | null,
          current_participants: s.current_participants as number | null,
          max_participants: s.max_participants as number | null,
        });
        sessionByCoach.set(aid, list);
      }
    }
  }

  const facById = new Map((facilities ?? []).map((f) => [f.id, f]));

  const pins: CoachMapPin[] = [];
  const citySet = new Set<string>();

  for (const c of coaches ?? []) {
    const sessions = sessionByCoach.get(c.id as string) ?? [];
    const kindsSet = new Set<SessionKind>();
    let nextAt: string | null = null;
    for (const s of sessions) {
      const kind = normalizeSessionKind(s.session_type);
      if (kind) kindsSet.add(kind);
    }
    for (const s of sessions) {
      if (!isSessionOpenForParentBrowse(s)) continue;
      const jp = s.join_policy ?? '';
      if (jp !== 'public' && jp !== 'invite_only') continue;
      const t = new Date(s.scheduled_datetime).getTime();
      if (nextAt === null || t < new Date(nextAt).getTime()) {
        nextAt = s.scheduled_datetime;
      }
    }
    const sessionKinds = Array.from(kindsSet);
    const hasOpenSession = coachHasOpenUpcomingSession(sessions);

    const addPin = (fid: string) => {
      const f = facById.get(fid);
      if (!f || f.latitude == null || f.longitude == null) return;
      const addr = (f.address as string | null) ?? null;
      if (addr) {
        const part = addr.split(',')[0]?.trim();
        if (part) citySet.add(part);
      }
      pins.push({
        pinKey: `${c.id}:${fid}`,
        coachId: c.id as string,
        firstName: c.first_name as string,
        lastName: c.last_name as string,
        photoUrl: (c.photo_url as string | null) ?? null,
        school: c.school as string,
        year: (c.year as string | null) ?? null,
        weightClass: (c.weight_class as string | null) ?? null,
        averageRating:
          c.average_rating != null ? Number(Number(c.average_rating).toFixed(1)) : null,
        reviewCount: Math.max(0, Number(c.review_count) || 0),
        facilityId: f.id as string,
        facilityName: f.name as string,
        facilityAddress: addr,
        latitude: Number(f.latitude),
        longitude: Number(f.longitude),
        nextSessionAt: nextAt,
        sessionKinds,
        hasOpenSession,
      });
    };

    if (c.facility_id && facilityIds.has(c.facility_id as string)) {
      addPin(c.facility_id as string);
    }
    if (c.secondary_facility_id && facilityIds.has(c.secondary_facility_id as string)) {
      if (c.secondary_facility_id !== c.facility_id) {
        addPin(c.secondary_facility_id as string);
      }
    }
  }

  const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b));

  return { ok: true, pins, cities };
}
