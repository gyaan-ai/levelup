import type { NextRequest } from 'next/server';

/**
 * Origin for Stripe success/cancel URLs so redirects land on the deployment and host
 * the user is actually using (e.g. *.vercel.app previews, consistent www vs apex).
 */
export function publicOriginForStripeRedirect(hostname: string, req: NextRequest): string {
  const h = hostname.split(':')[0].toLowerCase();
  if (h.endsWith('.vercel.app')) {
    return `https://${h}`;
  }
  if (h === 'localhost' || h.startsWith('127.')) {
    const raw = req.headers.get('host') || hostname;
    return raw.startsWith('localhost') || raw.startsWith('127.') ? `http://${raw}` : `http://${h}:3000`;
  }
  const canonical = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (canonical) {
    try {
      const ch = new URL(canonical).hostname.toLowerCase().replace(/^www\./, '');
      const hh = h.replace(/^www\./, '');
      if (ch === hh) return canonical;
    } catch {
      return canonical;
    }
  }
  return `https://${h}`;
}
