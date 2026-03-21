import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone, sendSms } from '@/lib/twilio';

type Admin = SupabaseClient;

/** Who receives the coach’s SMS blast */
export type SmsAudience = 'parents' | 'athletes' | 'both';

/**
 * Resolve SMS for a parent: users.phone first, then athlete cell on youth_wrestlers (fallback).
 */
export async function resolveParentSmsPhone(
  admin: Admin,
  parentId: string,
  youthWrestlerId: string | null
): Promise<string | null> {
  const { data: u } = await admin.from('users').select('phone').eq('id', parentId).maybeSingle();
  const up = normalizePhone(u?.phone ?? undefined);
  if (up) return up;
  if (youthWrestlerId) {
    const { data: yw } = await admin.from('youth_wrestlers').select('phone').eq('id', youthWrestlerId).maybeSingle();
    const yp = normalizePhone(yw?.phone ?? undefined);
    if (yp) return yp;
  }
  return null;
}

/** Athlete-only: cell on the youth wrestler profile (not parent account). */
export async function resolveAthleteSmsPhone(admin: Admin, youthWrestlerId: string): Promise<string | null> {
  const { data: yw } = await admin.from('youth_wrestlers').select('phone').eq('id', youthWrestlerId).maybeSingle();
  return normalizePhone(yw?.phone ?? undefined);
}

export type GroupSmsResult = {
  sent: number;
  skippedNoPhone: number;
  failed: Array<{ to: string; detail: string }>;
};

/**
 * Send the same SMS to unique numbers for this session based on audience.
 */
export async function sendSessionGroupSms(
  admin: Admin,
  sessionId: string,
  body: string,
  prefix: string,
  audience: SmsAudience = 'parents'
): Promise<GroupSmsResult> {
  const fullText = `${prefix}${body.trim()}`.slice(0, 1600);
  const { data: parts, error } = await admin
    .from('session_participants')
    .select('parent_id, youth_wrestler_id')
    .eq('session_id', sessionId);
  if (error) throw new Error(error.message);
  const rows = parts ?? [];
  if (rows.length === 0) {
    return { sent: 0, skippedNoPhone: 0, failed: [] };
  }

  const phonesToSend = new Set<string>();
  let skippedNoPhone = 0;

  if (audience === 'parents' || audience === 'both') {
    const byParent = new Map<string, string | null>();
    for (const row of rows) {
      const pid = row.parent_id as string | undefined;
      if (!pid) continue;
      if (!byParent.has(pid)) {
        byParent.set(pid, (row as { youth_wrestler_id?: string | null }).youth_wrestler_id ?? null);
      }
    }
    for (const [parentId, ywId] of byParent) {
      const phone = await resolveParentSmsPhone(admin, parentId, ywId);
      if (!phone) {
        skippedNoPhone += 1;
        continue;
      }
      phonesToSend.add(phone);
    }
  }

  if (audience === 'athletes' || audience === 'both') {
    const ywIds = new Set<string>();
    for (const row of rows) {
      const ywid = (row as { youth_wrestler_id?: string | null }).youth_wrestler_id;
      if (ywid) ywIds.add(ywid);
    }
    for (const ywid of ywIds) {
      const phone = await resolveAthleteSmsPhone(admin, ywid);
      if (!phone) {
        skippedNoPhone += 1;
        continue;
      }
      phonesToSend.add(phone);
    }
  }

  const failed: Array<{ to: string; detail: string }> = [];
  let sent = 0;
  for (const phone of phonesToSend) {
    const ok = await sendSms(phone, fullText);
    if (ok) sent += 1;
    else failed.push({ to: phone, detail: 'Twilio send failed' });
  }

  return { sent, skippedNoPhone, failed };
}

/**
 * Unified target string:
 * - `broadcast:parents` | `broadcast:athletes` | `broadcast:both`
 * - `parent:<uuid>` — one parent account in this session
 * - `athlete:<uuid>` — one youth wrestler in this session
 */
export async function sendSessionSms(
  admin: Admin,
  sessionId: string,
  body: string,
  prefix: string,
  target: string
): Promise<GroupSmsResult> {
  const t = target.trim();
  if (t.startsWith('broadcast:')) {
    const aud = t.replace('broadcast:', '') as SmsAudience;
    if (aud === 'athletes' || aud === 'both' || aud === 'parents') {
      return sendSessionGroupSms(admin, sessionId, body, prefix, aud);
    }
    return sendSessionGroupSms(admin, sessionId, body, prefix, 'parents');
  }

  const fullText = `${prefix}${body.trim()}`.slice(0, 1600);

  if (t.startsWith('parent:')) {
    const parentId = t.slice('parent:'.length);
    if (!parentId) return { sent: 0, skippedNoPhone: 1, failed: [] };
    const { data: row } = await admin
      .from('session_participants')
      .select('youth_wrestler_id')
      .eq('session_id', sessionId)
      .eq('parent_id', parentId)
      .limit(1)
      .maybeSingle();
    if (!row) return { sent: 0, skippedNoPhone: 1, failed: [] };
    const phone = await resolveParentSmsPhone(
      admin,
      parentId,
      (row as { youth_wrestler_id?: string | null }).youth_wrestler_id ?? null
    );
    if (!phone) return { sent: 0, skippedNoPhone: 1, failed: [] };
    const ok = await sendSms(phone, fullText);
    if (ok) return { sent: 1, skippedNoPhone: 0, failed: [] };
    return { sent: 0, skippedNoPhone: 0, failed: [{ to: phone, detail: 'Twilio send failed' }] };
  }

  if (t.startsWith('athlete:')) {
    const ywId = t.slice('athlete:'.length);
    if (!ywId) return { sent: 0, skippedNoPhone: 1, failed: [] };
    const { data: row } = await admin
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('youth_wrestler_id', ywId)
      .maybeSingle();
    if (!row) return { sent: 0, skippedNoPhone: 1, failed: [] };
    const phone = await resolveAthleteSmsPhone(admin, ywId);
    if (!phone) return { sent: 0, skippedNoPhone: 1, failed: [] };
    const ok = await sendSms(phone, fullText);
    if (ok) return { sent: 1, skippedNoPhone: 0, failed: [] };
    return { sent: 0, skippedNoPhone: 0, failed: [{ to: phone, detail: 'Twilio send failed' }] };
  }

  return sendSessionGroupSms(admin, sessionId, body, prefix, 'parents');
}
