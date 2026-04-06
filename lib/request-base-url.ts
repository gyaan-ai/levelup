import type { NextRequest } from 'next/server';

/** Prefer NEXT_PUBLIC_APP_URL in production; fall back to request host. */
export function getRequestBaseUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}
