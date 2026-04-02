import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAthleteSmsPhone, resolveParentSmsPhone } from '@/lib/session-group-sms';

export type CoachRosterEntry = {
  youthWrestlerId: string;
  parentId: string;
  kidFirstName: string;
  kidLastName: string;
  parentFirstName: string;
  parentLastName: string;
  /** E.164 from resolveParentSmsPhone, or null */
  parentPhone: string | null;
  kidPhone: string | null;
  lastSessionAt: string;
  sessionCount: number;
};

export type NextSessionShare = {
  sessionId: string;
  scheduledDatetime: string;
  registrationUrl: string;
  joinUrl: string | null;
};

/**
 * All distinct wrestlers who have booked at least one session with this coach,
 * with resolved parent/athlete cells for texting (same rules as session SMS helpers).
 */
export async function fetchCoachRosterData(
  admin: SupabaseClient,
  coachId: string,
  appOrigin: string
): Promise<{ entries: CoachRosterEntry[]; nextSession: NextSessionShare | null }> {
  const { data: sessions, error: sErr } = await admin
    .from('sessions')
    .select('id, scheduled_datetime, partner_invite_code')
    .eq('athlete_id', coachId);

  if (sErr) throw new Error(sErr.message);

  const sessList = sessions ?? [];
  if (sessList.length === 0) {
    return { entries: [], nextSession: null };
  }

  const sessionDateById = new Map<string, string>();
  for (const s of sessList) {
    sessionDateById.set(s.id, s.scheduled_datetime as string);
  }

  const sessionIds = sessList.map((s) => s.id);

  const { data: parts, error: pErr } = await admin
    .from('session_participants')
    .select(
      `
      youth_wrestler_id,
      parent_id,
      session_id,
      youth_wrestlers(id, first_name, last_name, phone)
    `
    )
    .in('session_id', sessionIds);

  if (pErr) throw new Error(pErr.message);

  type Agg = {
    youthWrestlerId: string;
    parentId: string;
    kidFirstName: string;
    kidLastName: string;
    lastSessionAt: string;
    sessionIds: Set<string>;
  };

  const byWrestler = new Map<string, Agg>();

  for (const p of parts ?? []) {
    const ywId = p.youth_wrestler_id as string | null;
    if (!ywId) continue;
    const yw = p.youth_wrestlers;
    const kid = Array.isArray(yw) ? yw[0] : yw;
    const sid = p.session_id as string;
    const scheduled = sessionDateById.get(sid) ?? '';
    const pid = p.parent_id as string;

    const row = byWrestler.get(ywId);
    if (!row) {
      byWrestler.set(ywId, {
        youthWrestlerId: ywId,
        parentId: pid,
        kidFirstName: (kid as { first_name?: string })?.first_name ?? '',
        kidLastName: (kid as { last_name?: string })?.last_name ?? '',
        lastSessionAt: scheduled,
        sessionIds: new Set([sid]),
      });
    } else {
      row.sessionIds.add(sid);
      if (scheduled > row.lastSessionAt) row.lastSessionAt = scheduled;
    }
  }

  const parentIds = [...new Set([...byWrestler.values()].map((r) => r.parentId))];
  const { data: parentUsers } =
    parentIds.length > 0
      ? await admin.from('users').select('id, first_name, last_name, phone').in('id', parentIds)
      : { data: [] };

  const parentById = new Map(
    (parentUsers ?? []).map((u) => [u.id as string, u as { id: string; first_name?: string | null; last_name?: string | null; phone?: string | null }])
  );

  const entries: CoachRosterEntry[] = [];

  for (const agg of byWrestler.values()) {
    const pu = parentById.get(agg.parentId);
    const parentPhoneResolved = await resolveParentSmsPhone(admin, agg.parentId, agg.youthWrestlerId);
    const kidPhoneResolved = await resolveAthleteSmsPhone(admin, agg.youthWrestlerId);

    entries.push({
      youthWrestlerId: agg.youthWrestlerId,
      parentId: agg.parentId,
      kidFirstName: agg.kidFirstName,
      kidLastName: agg.kidLastName,
      parentFirstName: pu?.first_name ?? '',
      parentLastName: pu?.last_name ?? '',
      parentPhone: parentPhoneResolved,
      kidPhone: kidPhoneResolved,
      lastSessionAt: agg.lastSessionAt,
      sessionCount: agg.sessionIds.size,
    });
  }

  entries.sort((a, b) => {
    const ln = a.kidLastName.localeCompare(b.kidLastName);
    if (ln !== 0) return ln;
    return a.kidFirstName.localeCompare(b.kidFirstName);
  });

  const nowIso = new Date().toISOString();
  const { data: nextSess } = await admin
    .from('sessions')
    .select('id, scheduled_datetime, partner_invite_code')
    .eq('athlete_id', coachId)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', nowIso)
    .order('scheduled_datetime', { ascending: true })
    .limit(1)
    .maybeSingle();

  let nextSession: NextSessionShare | null = null;
  if (nextSess) {
    const id = nextSess.id as string;
    const code = (nextSess as { partner_invite_code?: string | null }).partner_invite_code;
    nextSession = {
      sessionId: id,
      scheduledDatetime: nextSess.scheduled_datetime as string,
      registrationUrl: `${appOrigin}/sessions/${id}/register`,
      joinUrl: code ? `${appOrigin}/join/${code}` : null,
    };
  }

  return { entries, nextSession };
}
