import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/** Vercel Web Analytics Drain schema v1 */
type VercelAnalyticsEvent = {
  schema?: string;
  eventType: string;
  eventName?: string;
  timestamp: number;
  projectId?: string;
  deviceId?: number;
  sessionId?: number;
  path?: string;
  origin?: string;
};

function hmacSha1(data: Buffer, secret: string): string {
  return crypto.createHmac('sha1', secret).update(data).digest('hex');
}

/**
 * POST /api/admin/vercel-analytics-drain
 * Receives Web Analytics events from Vercel (configure in Vercel → Project → Settings → Drains).
 * Optional: set VERCEL_ANALYTICS_DRAIN_SECRET and use it as the "Signature Verification Secret" in the drain.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = process.env.VERCEL_ANALYTICS_DRAIN_SECRET;
    if (secret) {
      const signature = req.headers.get('x-vercel-signature');
      const expected = hmacSha1(Buffer.from(rawBody, 'utf-8'), secret);
      const sigBuf = signature ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length || sigBuf.length === 0 || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return NextResponse.json({ code: 'invalid_signature', error: "signature didn't match" }, { status: 403 });
      }
    }

    const payload = JSON.parse(rawBody) as VercelAnalyticsEvent | VercelAnalyticsEvent[];
    const events = Array.isArray(payload) ? payload : [payload];

    const byTenant = new Map<string, VercelAnalyticsEvent[]>();
    for (const e of events) {
      if (!e?.timestamp || !e?.eventType) continue;
      const origin = e.origin ?? '';
      let host = '';
      try {
        host = new URL(origin).hostname;
      } catch {
        host = '';
      }
      const tenant = host ? getTenantByDomain(host) : getTenantByDomain('localhost') ?? getTenantByDomain('www.wrestlingguild.com');
      const slug = tenant?.slug ?? 'guild';
      if (!byTenant.has(slug)) byTenant.set(slug, []);
      byTenant.get(slug)!.push(e);
    }

    for (const [slug, batch] of byTenant) {
      const admin = createAdminClient(slug);
      const rows = batch.map((e) => ({
        event_type: e.eventType,
        event_name: e.eventName ?? null,
        timestamp_ms: e.timestamp,
        device_id: e.deviceId ?? null,
        session_id: e.sessionId ?? null,
        path: e.path ?? null,
        origin: e.origin ?? null,
        project_id: e.projectId ?? null,
      }));
      await admin.from('vercel_analytics_events').insert(rows);
    }

    return NextResponse.json({ success: true, received: events.length });
  } catch (e) {
    console.error('Vercel analytics drain error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
