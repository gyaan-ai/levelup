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

type DayAvail = { blocked: boolean; slots: string[] };

function computeCoachWeek(
  coachId: string,
  ws: Date,
  slotRowsByCoach: Map<string, AvailabilitySlotDate[]>,
  recurringByCoach: Map<string, AvailabilitySlot[]>,
  blockedByCoach: Map<string, Set<string>>
): Record<string, DayAvail> {
  const slotRows = slotRowsByCoach.get(coachId) ?? [];
  const recurring = recurringByCoach.get(coachId) ?? [];
  const blockedSet = blockedByCoach.get(coachId) ?? new Set<string>();
  const days: Record<string, DayAvail> = {};
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
  return days;
}

const MAX_COACH_IDS = 400;

/**
 * POST — admin only. Batch published availability for many coaches for one Eastern week.
 * Body: { weekStart: "yyyy-MM-dd", coachIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      weekStart?: string;
      coachIds?: unknown;
    };
    const weekStartParam = body.weekStart?.trim();
    const rawIds = Array.isArray(body.coachIds) ? body.coachIds : [];
    const coachIds = [
      ...new Set(
        rawIds
          .map((id) => normalizeUuidParam(id))
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (!weekStartParam || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
      return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 });
    }
    if (coachIds.length > MAX_COACH_IDS) {
      return NextResponse.json(
        { error: `At most ${MAX_COACH_IDS} coaches per request` },
        { status: 400 }
      );
    }

    const z = toZonedTime(parseISO(`${weekStartParam}T12:00:00`), APP_TIMEZONE);
    const ws = startOfWeek(z, { weekStartsOn: 0 });
    const startYmd = formatInTimeZone(ws, APP_TIMEZONE, 'yyyy-MM-dd');
    const endYmd = formatInTimeZone(addDays(ws, 6), APP_TIMEZONE, 'yyyy-MM-dd');

    const byCoach: Record<string, Record<string, DayAvail>> = {};
    if (coachIds.length === 0) {
      return NextResponse.json({ byCoach, weekStart: startYmd, weekEnd: endYmd });
    }

    const admin = createAdminClient(tenant.slug);

    const [slotsRes, blocksRes, recurRes] = await Promise.all([
      admin
        .from('athlete_availability_slots')
        .select('athlete_id, slot_date, start_time, end_time')
        .in('athlete_id', coachIds)
        .gte('slot_date', startYmd)
        .lte('slot_date', endYmd),
      admin
        .from('athlete_availability_blocks')
        .select('athlete_id, blocked_date')
        .in('athlete_id', coachIds)
        .gte('blocked_date', startYmd)
        .lte('blocked_date', endYmd),
      admin
        .from('athlete_availability')
        .select('athlete_id, day_of_week, start_time, end_time')
        .in('athlete_id', coachIds),
    ]);

    const slotRowsByCoach = new Map<string, AvailabilitySlotDate[]>();
    if (slotsRes.error && !skipTableErr(slotsRes.error)) {
      return NextResponse.json({ error: slotsRes.error.message }, { status: 500 });
    }
    for (const r of slotsRes.data ?? []) {
      const row = r as { athlete_id: string; slot_date: string; start_time: string; end_time: string };
      if (!row.athlete_id) continue;
      const list = slotRowsByCoach.get(row.athlete_id) ?? [];
      list.push({
        slot_date: row.slot_date,
        start_time: row.start_time,
        end_time: row.end_time,
      });
      slotRowsByCoach.set(row.athlete_id, list);
    }

    const blockedByCoach = new Map<string, Set<string>>();
    if (blocksRes.error && !skipTableErr(blocksRes.error)) {
      return NextResponse.json({ error: blocksRes.error.message }, { status: 500 });
    }
    for (const r of blocksRes.data ?? []) {
      const row = r as { athlete_id?: string; blocked_date?: string };
      if (!row.athlete_id || !row.blocked_date) continue;
      const set = blockedByCoach.get(row.athlete_id) ?? new Set();
      set.add(row.blocked_date);
      blockedByCoach.set(row.athlete_id, set);
    }

    const recurringByCoach = new Map<string, AvailabilitySlot[]>();
    if (recurRes.error && !skipTableErr(recurRes.error)) {
      return NextResponse.json({ error: recurRes.error.message }, { status: 500 });
    }
    for (const r of recurRes.data ?? []) {
      const row = r as {
        athlete_id?: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
      };
      if (!row.athlete_id) continue;
      const list = recurringByCoach.get(row.athlete_id) ?? [];
      list.push({
        day_of_week: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
      });
      recurringByCoach.set(row.athlete_id, list);
    }

    for (const id of coachIds) {
      byCoach[id] = computeCoachWeek(id, ws, slotRowsByCoach, recurringByCoach, blockedByCoach);
    }

    return NextResponse.json({ byCoach, weekStart: startYmd, weekEnd: endYmd });
  } catch (e) {
    console.error('admin coaches-week-availability POST:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
