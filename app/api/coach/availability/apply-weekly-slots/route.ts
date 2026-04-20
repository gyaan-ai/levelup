import { NextRequest, NextResponse } from 'next/server';
import { addDays, parseISO } from 'date-fns';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { formatEST, easternSundayZeroDowFromYmd } from '@/lib/format-date';
import { notifyAvailabilityFollowers } from '@/lib/notify-availability-followers';

function padTime(t: string): string {
  const s = String(t ?? '').trim();
  if (!s) return '09:00:00';
  const parts = s.split(':');
  const h = String(parseInt(parts[0] || '0', 10) || 0).padStart(2, '0');
  const m = String(parseInt(parts[1] || '0', 10) || 0).padStart(2, '0');
  const sec = parts[2] != null ? String(parseInt(parts[2], 10) || 0).padStart(2, '0') : '00';
  return `${h}:${m}:${sec}`;
}

function slotKey(slotDate: string, startTimeRaw: string): string {
  return `${slotDate}|${padTime(startTimeRaw)}`;
}

/**
 * POST — Create dated availability slots for the next N Eastern calendar days
 * from this coach's weekly `athlete_availability` windows (skips blocked dates and duplicates).
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
    if (userData?.role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { days?: unknown };
    let days = Number(body.days);
    if (!Number.isFinite(days) || days < 1) days = 14;
    if (days > 28) days = 28;

    const todayEastern = formatEST(new Date(), 'yyyy-MM-dd');
    const endDateStr = formatEST(addDays(parseISO(todayEastern), days - 1), 'yyyy-MM-dd');

    const { data: windows, error: winErr } = await supabase
      .from('athlete_availability')
      .select('day_of_week, start_time, end_time')
      .eq('athlete_id', user.id);

    if (winErr) return NextResponse.json({ error: winErr.message }, { status: 500 });
    if (!windows?.length) {
      return NextResponse.json(
        {
          error: 'Add at least one weekly window first (see "Weekly template" on this page).',
          added: 0,
        },
        { status: 400 }
      );
    }

    const { data: blockRows, error: blockErr } = await supabase
      .from('athlete_availability_blocks')
      .select('blocked_date')
      .eq('athlete_id', user.id)
      .gte('blocked_date', todayEastern)
      .lte('blocked_date', endDateStr);

    if (blockErr && !blockErr.message?.includes('does not exist')) {
      return NextResponse.json({ error: blockErr.message }, { status: 500 });
    }

    const blocked = new Set(
      (blockRows ?? []).map((b: { blocked_date: string }) => String(b.blocked_date).slice(0, 10))
    );

    const { data: existingRows, error: exErr } = await supabase
      .from('athlete_availability_slots')
      .select('slot_date, start_time')
      .eq('athlete_id', user.id)
      .gte('slot_date', todayEastern)
      .lte('slot_date', endDateStr);

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    const existingKeys = new Set(
      (existingRows ?? []).map((r: { slot_date: string; start_time: string }) =>
        slotKey(r.slot_date, r.start_time)
      )
    );

    const insertRows: {
      athlete_id: string;
      slot_date: string;
      start_time: string;
      end_time: string;
    }[] = [];

    for (let i = 0; i < days; i++) {
      const dateStr = formatEST(addDays(parseISO(todayEastern), i), 'yyyy-MM-dd');
      if (blocked.has(dateStr)) continue;
      const dow = easternSundayZeroDowFromYmd(dateStr);
      for (const w of windows as { day_of_week: number; start_time: string; end_time: string }[]) {
        if (w.day_of_week !== dow) continue;
        const start = padTime(String(w.start_time));
        const end = padTime(String(w.end_time));
        const key = slotKey(dateStr, start);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        insertRows.push({
          athlete_id: user.id,
          slot_date: dateStr,
          start_time: start,
          end_time: end,
        });
      }
    }

    if (insertRows.length === 0) {
      return NextResponse.json({
        added: 0,
        message: 'No new slots to add — you may already have these times, or those days are blocked.',
      });
    }

    const { error: insErr } = await supabase.from('athlete_availability_slots').insert(insertRows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    notifyAvailabilityFollowers(tenant.slug, user.id);

    return NextResponse.json({ added: insertRows.length, days });
  } catch (e) {
    console.error('apply-weekly-slots POST:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
