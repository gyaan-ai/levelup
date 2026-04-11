import type { NextRequest } from 'next/server';

/**
 * Canonical public origin for redirects (Stripe, password reset, etc.).
 * Prefer NEXT_PUBLIC_APP_URL in production so emails never use the wrong host.
 */
export function getPublicSiteUrlFromRequest(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto =
    req.headers.get('x-forwarded-proto') ||
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
