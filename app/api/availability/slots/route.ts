import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { slotsForDay, type AvailabilitySlot } from '@/lib/availability';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get('athleteId');
    const dateParam = searchParams.get('date');
    if (!athleteId || !dateParam) {
      return NextResponse.json({ error: 'Missing athleteId or date' }, { status: 400 });
    }

    const d = new Date(dateParam);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const supabase = await createClient(tenant.slug);

    const { data: availRows, error: availErr } = await supabase
      .from('athlete_availability')
      .select('day_of_week, start_time, end_time')
      .eq('athlete_id', athleteId);

    if (availErr) {
      return NextResponse.json({ error: availErr.message }, { status: 500 });
    }

    const availability: AvailabilitySlot[] = (availRows || []).map(
      (r: { day_of_week: number; start_time: string; end_time: string }) => ({
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
      })
    );

    const dayOfWeek = d.getDay();
    const allSlots = slotsForDay(availability, dayOfWeek);

    if (allSlots.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    const dateOnly = dateParam.split('T')[0];
    const dayStart = `${dateOnly}T00:00:00`;
    const dayEnd = `${dateOnly}T23:59:59`;

    const { data: sessions } = await supabase
      .from('sessions')
      .select('scheduled_datetime')
      .eq('athlete_id', athleteId)
      .in('status', ['scheduled', 'pending_payment', 'completed'])
      .gte('scheduled_datetime', dayStart)
      .lte('scheduled_datetime', dayEnd);

    const booked = new Set<string>();
    for (const s of sessions || []) {
      const t = (s as { scheduled_datetime: string }).scheduled_datetime;
      const [, timePart] = t.split('T');
      const [h, m] = (timePart || '').split(':').map((x) => parseInt(x, 10) || 0);
      booked.add(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }

    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const slots = allSlots.filter((slot) => {
      if (booked.has(slot)) return false;
      if (isToday && slot <= currentHHmm) return false;
      return true;
    });

    return NextResponse.json({ slots });
  } catch (e) {
    console.error('Availability slots API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
