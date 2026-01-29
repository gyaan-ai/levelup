import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { timeToHHmm } from '@/lib/availability';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get('athleteId');
    if (!athleteId) {
      return NextResponse.json({ error: 'Missing athleteId' }, { status: 400 });
    }

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const supabase = await createClient(tenant.slug);
    const { data: rows, error } = await supabase
      .from('athlete_availability')
      .select('day_of_week, start_time, end_time')
      .eq('athlete_id', athleteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const availability = (rows || []).map((r: { day_of_week: number; start_time: string; end_time: string }) => ({
      day_of_week: r.day_of_week,
      start_time: timeToHHmm(r.start_time),
      end_time: timeToHHmm(r.end_time),
    }));

    return NextResponse.json({ availability });
  } catch (e) {
    console.error('Availability API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
