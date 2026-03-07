import { createHmac, timingSafeEqual } from 'crypto';

const ALG = 'sha256';
const DEFAULT_EXPIRY_DAYS = 7;

function getSecret(required: true): string;
function getSecret(required?: false): string | null;
function getSecret(required?: boolean): string | null {
  const secret = process.env.PARENT_INVITE_SECRET || process.env.INVITE_PARENT_SECRET;
  if (!secret || secret.length < 16) {
    if (required) throw new Error('PARENT_INVITE_SECRET or INVITE_PARENT_SECRET (min 16 chars) required for invite links');
    return null;
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return Buffer.from(b64, 'base64');
}

export interface InvitePayload {
  youthWrestlerId: string;
  exp: number;
}

/** Create a signed invite token for linking another parent to a youth wrestler. */
export function createInviteToken(
  youthWrestlerId: string,
  expiresInDays: number = DEFAULT_EXPIRY_DAYS
): string {
  const secret = getSecret(true);
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload = JSON.stringify({ youthWrestlerId, exp });
  const payloadB64 = base64UrlEncode(Buffer.from(payload, 'utf8'));
  const sig = createHmac(ALG, secret).update(payloadB64).digest();
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

/** Verify and decode an invite token. Returns payload or null if invalid/expired. */
export function verifyInviteToken(token: string): InvitePayload | null {
  try {
    const secret = getSecret(false);
    if (!secret) return null;
    const i = token.indexOf('.');
    if (i <= 0) return null;
    const payloadB64 = token.slice(0, i);
    const sigB64 = token.slice(i + 1);
    const sig = base64UrlDecode(sigB64);
    const expected = createHmac(ALG, secret).update(payloadB64).digest();
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
    const payload = JSON.parse(Buffer.from(base64UrlDecode(payloadB64)).toString('utf8')) as InvitePayload;
    if (!payload.youthWrestlerId || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
