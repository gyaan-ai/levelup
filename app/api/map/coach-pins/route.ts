import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getTenantByDomain } from '@/config/tenants';
import { fetchCoachMapPins } from '@/lib/map/fetch-coach-map-pins';

export const dynamic = 'force-dynamic';

export type { SessionKind } from '@/lib/map/fetch-coach-map-pins';

export async function GET() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) {
    return NextResponse.json({ error: 'Unknown host' }, { status: 404 });
  }

  const result = await fetchCoachMapPins(tenant.slug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    pins: result.pins,
    cities: result.cities,
    stats: result.stats,
  });
}
