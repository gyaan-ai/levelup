import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantConfig, getTenantFromRequestHeaders } from '@/config/tenants';
import { purgeEmptyPastSessions } from '@/lib/purge-empty-past-sessions';

/**
 * Daily cron: remove past scheduled sessions with zero participants (never booked).
 * Production: set CRON_SECRET and send Authorization: Bearer <CRON_SECRET> (configure in Vercel cron or proxy).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');
  if (process.env.NODE_ENV === 'production') {
    const ok =
      secret &&
      (auth === `Bearer ${secret}` || querySecret === secret);
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const headersList = await headers();
  let tenant = getTenantFromRequestHeaders(headersList);
  if (!tenant) {
    try {
      tenant = getTenantConfig('guild');
    } catch {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
  }

  const admin = createAdminClient(tenant.slug);
  const deleted = await purgeEmptyPastSessions(admin);
  return NextResponse.json({ ok: true, deleted });
}
