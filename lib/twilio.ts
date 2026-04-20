/**
 * Twilio SMS for coach alerts (e.g. when someone signs up for their session).
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in env.
 * Coaches store cell on users.phone; we send only when present (with zelle-shaped fallback).
 */

import { logMessage } from './message-log';

export type SupabaseAdmin = import('@supabase/supabase-js').SupabaseClient;

const getConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
};

/** Normalize to E.164-ish: digits only, assume US +1 if 10 digits. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

export type SmsLogContext = {
  admin?: SupabaseAdmin;
  messageType?: string;
  recipientId?: string;
  recipientLabel?: string;
  sessionId?: string;
  coachId?: string;
};

/**
 * Send an SMS. No-op if Twilio is not configured or to is invalid.
 * Optionally logs to message_log if admin client is provided.
 */
export async function sendSms(to: string, body: string, logCtx?: SmsLogContext): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;
  const phone = normalizePhone(to);
  if (!phone) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: config.from,
          Body: body.slice(0, 1600),
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.warn('Twilio SMS failed', res.status, err);
      // Log failed SMS
      if (logCtx?.admin) {
        void logMessage(logCtx.admin, {
          channel: 'sms',
          recipientId: logCtx.recipientId,
          recipientPhone: phone,
          recipientLabel: logCtx.recipientLabel,
          messageType: logCtx.messageType ?? 'sms',
          body,
          sessionId: logCtx.sessionId,
          coachId: logCtx.coachId,
          status: 'failed',
          errorDetail: err,
        });
      }
      return false;
    }
    // Log successful SMS
    if (logCtx?.admin) {
      void logMessage(logCtx.admin, {
        channel: 'sms',
        recipientId: logCtx.recipientId,
        recipientPhone: phone,
        recipientLabel: logCtx.recipientLabel,
        messageType: logCtx.messageType ?? 'sms',
        body,
        sessionId: logCtx.sessionId,
        coachId: logCtx.coachId,
        status: 'sent',
      });
    }
    return true;
  } catch (e) {
    console.warn('Twilio SMS error', e);
    return false;
  }
}

/** Prefer users.phone; fall back to athletes.zelle_email if it looks like a phone (coaches often put cell there for Zelle). */
function pickCoachPhone(row: { phone?: string; zelle_email?: string } | null): string | null {
  if (!row) return null;
  const p = (row as { phone?: string }).phone;
  if (p && normalizePhone(p)) return p;
  const z = (row as { zelle_email?: string }).zelle_email;
  if (z && normalizePhone(z)) return z; // Zelle allows email or phone — use if phone-shaped
  return null;
}

async function resolveCoachSmsE164(admin: SupabaseAdmin, coachUserId: string): Promise<string | null> {
  const [{ data: userRow }, { data: athleteRow }] = await Promise.all([
    admin.from('users').select('phone').eq('id', coachUserId).maybeSingle(),
    admin.from('athletes').select('zelle_email').eq('id', coachUserId).maybeSingle(),
  ]);
  const raw = pickCoachPhone({
    phone: userRow?.phone ?? undefined,
    zelle_email: athleteRow?.zelle_email ?? undefined,
  });
  return raw ? normalizePhone(raw) : null;
}

/** Comma-separated phones in env + any `users.phone` for role=admin. Deduped E.164. */
async function collectAdminBookingAlertPhonesE164(admin: SupabaseAdmin): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const n = normalizePhone(raw ?? undefined);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };
  const envRaw = process.env.ADMIN_BOOKING_ALERT_PHONES || '';
  for (const part of envRaw.split(',')) push(part.trim());

  const { data: admins } = await admin.from('users').select('phone').eq('role', 'admin');
  for (const row of admins ?? []) push((row as { phone?: string }).phone);

  return out;
}

function shortSessionRef(sessionId: string): string {
  return sessionId.replace(/-/g, '').slice(0, 10);
}

/**
 * Coach SMS + optional ops SMS for every new booking/signup.
 * Ops numbers: `ADMIN_BOOKING_ALERT_PHONES` (comma-separated) plus all admin users with `users.phone`.
 * Skips texting the same number twice when coach and ops share a cell.
 */
export async function notifyCoachAndAdminsNewBooking(
  admin: SupabaseAdmin,
  coachUserId: string,
  dateStr: string,
  sessionId?: string
): Promise<void> {
  await sendCoachNewSignupSms(admin, coachUserId, dateStr, sessionId);

  const coachE164 = await resolveCoachSmsE164(admin, coachUserId);
  const opsTargets = await collectAdminBookingAlertPhonesE164(admin);
  if (opsTargets.length === 0) return;

  const { data: athlete } = await admin
    .from('athletes')
    .select('first_name, last_name')
    .eq('id', coachUserId)
    .maybeSingle();
  const coachLabel = athlete
    ? [athlete.first_name, athlete.last_name].filter(Boolean).join(' ').trim() || 'Coach'
    : 'Coach';
  const ref = sessionId ? shortSessionRef(sessionId) : '';
  const body = ref
    ? `LevelUp (ops): New booking ${dateStr} · ${coachLabel}. Ref ${ref}`
    : `LevelUp (ops): New booking ${dateStr} · ${coachLabel}.`;

  for (const to of opsTargets) {
    if (coachE164 && to === coachE164) continue;
    await sendSms(to, body, {
      admin,
      messageType: 'admin_booking_alert',
      recipientLabel: 'Admin ops',
      sessionId,
      coachId: coachUserId,
    });
  }
}

/**
 * If the coach has a phone on file (users.phone or athletes.zelle_email when phone-shaped), send SMS.
 * Prefer {@link notifyCoachAndAdminsNewBooking} for booking flows so ops can get a copy.
 */
export async function sendCoachNewSignupSms(
  admin: SupabaseAdmin,
  coachUserId: string,
  dateStr: string,
  sessionId?: string
): Promise<void> {
  const phone = await resolveCoachSmsE164(admin, coachUserId);
  if (!phone) return;
  const body = `LevelUp: New booking for ${dateStr}. Check My sessions in the app.`;
  await sendSms(phone, body, {
    admin,
    messageType: 'coach_new_signup',
    recipientId: coachUserId,
    recipientLabel: 'Coach',
    sessionId,
    coachId: coachUserId,
  });
}

/**
 * SMS coach when a parent leaves a new review (not on edit/update of same review).
 * Uses users.phone or phone-shaped athletes.zelle_email — same as signup SMS.
 */
export async function sendCoachNewReviewSms(
  admin: SupabaseAdmin,
  coachAthleteId: string,
  rating: number,
  profileUrl: string
): Promise<void> {
  const [{ data: userRow }, { data: athleteRow }] = await Promise.all([
    admin.from('users').select('phone').eq('id', coachAthleteId).maybeSingle(),
    admin.from('athletes').select('zelle_email').eq('id', coachAthleteId).maybeSingle(),
  ]);
  const phone = pickCoachPhone({
    phone: userRow?.phone ?? undefined,
    zelle_email: athleteRow?.zelle_email ?? undefined,
  });
  if (!phone) return;
  const r = Math.min(5, Math.max(1, Math.round(rating)));
  const starLabel = r === 1 ? '1-star' : `${r}-star`;
  const body = `The Guild: You got a new ${starLabel} review. See it now: ${profileUrl}`;
  await sendSms(phone, body, {
    admin,
    messageType: 'coach_new_review',
    recipientId: coachAthleteId,
    recipientLabel: 'Coach',
    coachId: coachAthleteId,
  });
}
