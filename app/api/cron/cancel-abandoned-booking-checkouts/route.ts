import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenants } from '@/config/tenants';
import { cancelAbandonedBookingCheckoutSessions } from '@/lib/cancel-abandoned-booking-checkouts';

/**
 * Hourly: cancel parent book-a-coach session shells that never completed Stripe (no roster).
 * Min age: ABANDONED_BOOKING_CHECKOUT_MIN_HOURS or 36 hours.
 * Production: CRON_SECRET + Authorization: Bearer (same as other crons).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');
  if (process.env.NODE_ENV === 'production') {
    const ok = secret && (auth === `Bearer ${secret}` || querySecret === secret);
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const raw = process.env.ABANDONED_BOOKING_CHECKOUT_MIN_HOURS?.trim();
  const parsed = raw ? Number(raw) : NaN;
  const minHours = Number.isFinite(parsed) && parsed >= 6 ? parsed : 36;

  const byTenant: Record<string, number> = {};
  let cancelled = 0;
  for (const slug of Object.keys(tenants)) {
    try {
      const admin = createAdminClient(slug);
      const n = await cancelAbandonedBookingCheckoutSessions(admin, minHours);
      byTenant[slug] = n;
      cancelled += n;
    } catch (e) {
      console.error(`cancel-abandoned-booking-checkouts tenant ${slug}:`, e);
      byTenant[slug] = 0;
    }
  }

  return NextResponse.json({ ok: true, cancelled, minHours, byTenant });
}
