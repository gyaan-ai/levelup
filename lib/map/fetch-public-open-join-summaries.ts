import { createAdminClient } from '@/lib/supabase/admin';
import { isSessionOpenForParentBrowse } from '@/lib/sessions';

export type PublicCoachOpenJoinRow = {
  coachId: string;
  coachName: string;
  /** Open public join-in sessions in the window (partner-open / small group / 2-athlete). */
  openCount: number;
  nextSessionId: string;
  nextAt: string;
  nextKind: string;
  facilityName: string;
};

function coachNameFromSession(s: {
  athletes?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
}): string {
  const a = s.athletes;
  const o = Array.isArray(a) ? a[0] : a;
  const n = [o?.first_name, o?.last_name].filter(Boolean).join(' ').trim();
  return n || 'Coach';
}

function facilityNameFromSession(s: {
  facilities?: { name?: string } | { name?: string }[] | null;
}): string {
  const f = s.facilities;
  const fo = Array.isArray(f) ? f[0] : f;
  return fo?.name?.trim() || '—';
}

function labelKind(session_type: string | null, session_mode: string | null): string {
  const sm = (session_mode ?? '').toLowerCase();
  const st = (session_type ?? '').toLowerCase();
  if (sm === 'partner-open' || st === '2-athlete' || st === 'partner') return 'Partner';
  return 'Small group';
}

type SessionRow = {
  id: string;
  scheduled_datetime: string;
  session_type: string | null;
  session_mode: string | null;
  join_policy: string | null;
  current_participants: number | null;
  max_participants: number | null;
  athlete_id: string;
  athletes?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
  facilities?: { name?: string } | { name?: string }[] | null;
  session_participants?: unknown[] | null;
};

const SESSION_SELECT = `
  id,
  scheduled_datetime,
  session_type,
  session_mode,
  join_policy,
  current_participants,
  max_participants,
  athlete_id,
  athletes(id, first_name, last_name),
  facilities(id, name, address),
  session_participants(id, youth_wrestler_id)
`;

/** Public join-in sessions (open partner + small group) for marketing / home table. Service role on server only. */
export async function fetchPublicOpenJoinSummaries(
  tenantSlug: string,
  options?: { daysAhead?: number; maxCoaches?: number }
): Promise<PublicCoachOpenJoinRow[]> {
  const days = options?.daysAhead ?? 21;
  const maxCoaches = options?.maxCoaches ?? 50;
  const admin = createAdminClient(tenantSlug);
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + days);
  const from = now.toISOString();
  const to = until.toISOString();

  const [groupRes, partnerRes] = await Promise.all([
    admin
      .from('sessions')
      .select(SESSION_SELECT)
      .in('status', ['scheduled', 'pending_payment'])
      .eq('join_policy', 'public')
      .gte('scheduled_datetime', from)
      .lte('scheduled_datetime', to)
      .in('session_type', ['group', 'small_group', '2-athlete'])
      .order('scheduled_datetime', { ascending: true }),
    admin
      .from('sessions')
      .select(SESSION_SELECT)
      .in('status', ['scheduled', 'pending_payment'])
      .eq('join_policy', 'public')
      .gte('scheduled_datetime', from)
      .lte('scheduled_datetime', to)
      .eq('session_mode', 'partner-open')
      .order('scheduled_datetime', { ascending: true }),
  ]);

  if (groupRes.error) console.error('[fetchPublicOpenJoinSummaries] group', groupRes.error);
  if (partnerRes.error) console.error('[fetchPublicOpenJoinSummaries] partner', partnerRes.error);

  const raw = [...(groupRes.data ?? []), ...(partnerRes.data ?? [])] as SessionRow[];
  const seen = new Set<string>();
  const merged: SessionRow[] = [];
  for (const r of raw) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }

  const open = merged.filter((s) => isSessionOpenForParentBrowse(s));
  const byCoach = new Map<string, { name: string; sessions: SessionRow[] }>();

  for (const s of open) {
    const aid = s.athlete_id;
    if (!aid) continue;
    const name = coachNameFromSession(s);
    const cur = byCoach.get(aid) ?? { name, sessions: [] };
    cur.sessions.push(s);
    byCoach.set(aid, cur);
  }

  const out: PublicCoachOpenJoinRow[] = [];
  for (const [coachId, { name, sessions: coachSessions }] of byCoach) {
    coachSessions.sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime));
    const next = coachSessions[0];
    if (!next) continue;
    out.push({
      coachId,
      coachName: name,
      openCount: coachSessions.length,
      nextSessionId: next.id,
      nextAt: next.scheduled_datetime,
      nextKind: labelKind(next.session_type, next.session_mode),
      facilityName: facilityNameFromSession(next),
    });
  }

  out.sort((a, b) => a.nextAt.localeCompare(b.nextAt));
  return out.slice(0, maxCoaches);
}
