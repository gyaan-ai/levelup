import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { addDays, parseISO, startOfWeek } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { APP_TIMEZONE, easternSundayZeroDowFromYmd } from '@/lib/format-date';
import {
  slotsForDate,
  slotsForDay,
  type AvailabilitySlot,
  type AvailabilitySlotDate,
} from '@/lib/availability';
import { normalizeUuidParam } from '@/lib/normalize-uuid-param';

function skipTableErr(err: { message?: string; code?: string } | null) {
  return Boolean(err && (err.message?.includes('does not exist') || err.code === '42P01'));
}

/**
 * GET — admin only. Published coach availability for a calendar week (Eastern Sun–Sat).
 * Query: coachId (uuid), weekStart (yyyy-MM-dd, any day in the week — normalized to Sunday).
 */
export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const coachId = normalizeUuidParam(searchParams.get('coachId'));
    const weekStartParam = searchParams.get('weekStart')?.trim();
    if (!coachId || !weekStartParam || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
      return NextResponse.json({ error: 'Missing or invalid coachId or weekStart' }, { status: 400 });
    }

    const z = toZonedTime(parseISO(`${weekStartParam}T12:00:00`), APP_TIMEZONE);
    const ws = startOfWeek(z, { weekStartsOn: 0 });
    const startYmd = formatInTimeZone(ws, APP_TIMEZONE, 'yyyy-MM-dd');
    const endYmd = formatInTimeZone(addDays(ws, 6), APP_TIMEZONE, 'yyyy-MM-dd');

    const admin = createAdminClient(tenant.slug);

    const [blocksRes, slotsRes, recurRes] = await Promise.all([
      admin
        .from('athlete_availability_blocks')
        .select('blocked_date')
        .eq('athlete_id', coachId)
        .gte('blocked_date', startYmd)
        .lte('blocked_date', endYmd),
      admin
        .from('athlete_availability_slots')
        .select('slot_date, start_time, end_time')
        .eq('athlete_id', coachId)
        .gte('slot_date', startYmd)
        .lte('slot_date', endYmd),
      admin.from('athlete_availability').select('day_of_week, start_time, end_time').eq('athlete_id', coachId),
    ]);

    const blockedSet = new Set<string>();
    if (blocksRes.error && !skipTableErr(blocksRes.error)) {
      return NextResponse.json({ error: blocksRes.error.message }, { status: 500 });
    }
    for (const r of blocksRes.data ?? []) {
      const bd = (r as { blocked_date?: string }).blocked_date;
      if (bd) blockedSet.add(bd);
    }

    let slotRows: AvailabilitySlotDate[] = [];
    if (slotsRes.error) {
      if (!skipTableErr(slotsRes.error)) {
        return NextResponse.json({ error: slotsRes.error.message }, { status: 500 });
      }
    } else {
      slotRows = (slotsRes.data ?? []) as AvailabilitySlotDate[];
    }

    let recurring: AvailabilitySlot[] = [];
    if (recurRes.error) {
      if (!skipTableErr(recurRes.error)) {
        return NextResponse.json({ error: recurRes.error.message }, { status: 500 });
      }
    } else {
      recurring = (recurRes.data ?? []).map(
        (r: { day_of_week: number; start_time: string; end_time: string }) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
        })
      );
    }

    const days: Record<string, { blocked: boolean; slots: string[] }> = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const ymd = formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd');
      if (blockedSet.has(ymd)) {
        days[ymd] = { blocked: true, slots: [] };
        continue;
      }
      const dateSpecific = slotRows.filter((row) => row.slot_date === ymd);
      const dateSlots = slotsForDate(dateSpecific);
      const dow = easternSundayZeroDowFromYmd(ymd);
      const recurSlots = slotsForDay(recurring, dow);
      const merged = [...new Set([...dateSlots, ...recurSlots])].sort();
      days[ymd] = { blocked: false, slots: merged };
    }

    return NextResponse.json({ days, weekStart: startYmd, weekEnd: endYmd });
  } catch (e) {
    console.error('admin coach-week-availability GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
