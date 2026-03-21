/**
 * Twilio SMS for coach alerts (e.g. when someone signs up for their session).
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in env.
 * Coaches store cell on users.phone; we send only when present (with zelle-shaped fallback).
 */

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

/**
 * Send an SMS. No-op if Twilio is not configured or to is invalid.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
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
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Twilio SMS error', e);
    return false;
  }
}

export type SupabaseAdmin = import('@supabase/supabase-js').SupabaseClient;

/** Prefer users.phone; fall back to athletes.zelle_email if it looks like a phone (coaches often put cell there for Zelle). */
function pickCoachPhone(row: { phone?: string; zelle_email?: string } | null): string | null {
  if (!row) return null;
  const p = (row as { phone?: string }).phone;
  if (p && normalizePhone(p)) return p;
  const z = (row as { zelle_email?: string }).zelle_email;
  if (z && normalizePhone(z)) return z; // Zelle allows email or phone — use if phone-shaped
  return null;
}

/**
 * If the coach has a phone on file (users.phone or athletes.zelle_email when phone-shaped), send SMS.
 * Call after createNotification for session_booked.
 */
export async function sendCoachNewSignupSms(
  admin: SupabaseAdmin,
  coachUserId: string,
  dateStr: string
): Promise<void> {
  const [{ data: userRow }, { data: athleteRow }] = await Promise.all([
    admin.from('users').select('phone').eq('id', coachUserId).maybeSingle(),
    admin.from('athletes').select('zelle_email').eq('id', coachUserId).maybeSingle(),
  ]);
  const phone = pickCoachPhone({
    phone: userRow?.phone ?? undefined,
    zelle_email: athleteRow?.zelle_email ?? undefined,
  });
  if (!phone) return;
  await sendSms(
    phone,
    `LevelUp: Someone signed up for your session on ${dateStr}. Check My sessions in the app.`
  );
}
