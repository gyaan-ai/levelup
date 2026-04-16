import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenants } from '@/config/tenants';
import { purgeEmptyPastSessions } from '@/lib/purge-empty-past-sessions';

/**
 * Daily cron: remove past sessions with zero roster rows (no kids registered).
 * Runs once per configured tenant DB. Production: set CRON_SECRET; Vercel cron sends Authorization: Bearer <CRON_SECRET>.
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

  const byTenant: Record<string, number> = {};
  let deleted = 0;
  for (const slug of Object.keys(tenants)) {
    try {
      const admin = createAdminClient(slug);
      const n = await purgeEmptyPastSessions(admin);
      byTenant[slug] = n;
      deleted += n;
    } catch (e) {
      console.error(`purge-empty-past-sessions tenant ${slug}:`, e);
      byTenant[slug] = 0;
    }
  }

  return NextResponse.json({ ok: true, deleted, byTenant });
}
