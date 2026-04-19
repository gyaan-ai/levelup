import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { timeToHHmm } from '@/lib/availability';

type WindowInput = { day_of_week: number; start_time: string; end_time: string };

function padTime(t: string): string {
  const s = t.trim();
  if (!s) return '09:00:00';
  const parts = s.split(':');
  const h = String(parseInt(parts[0] || '0', 10) || 0).padStart(2, '0');
  const m = String(parseInt(parts[1] || '0', 10) || 0).padStart(2, '0');
  const sec = parts[2] != null ? String(parseInt(parts[2], 10) || 0).padStart(2, '0') : '00';
  return `${h}:${m}:${sec}`;
}

function windowMinutes(start: string, end: string): number {
  const [sh, sm] = timeToHHmm(start).split(':').map((x) => parseInt(x, 10) || 0);
  const [eh, em] = timeToHHmm(end).split(':').map((x) => parseInt(x, 10) || 0);
  return eh * 60 + em - (sh * 60 + sm);
}

export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: rows, error } = await supabase
      .from('athlete_availability')
      .select('id, day_of_week, start_time, end_time')
      .eq('athlete_id', user.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const windows = (rows || []).map((r: { id: string; day_of_week: number; start_time: string; end_time: string }) => ({
      id: r.id,
      day_of_week: r.day_of_week,
      start_time: timeToHHmm(r.start_time),
      end_time: timeToHHmm(r.end_time),
    }));

    return NextResponse.json({ windows });
  } catch (e) {
    console.error('coach availability weekly GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { windows?: WindowInput[] };
    const raw = Array.isArray(body.windows) ? body.windows : [];

    for (const w of raw) {
      const dow = Number(w.day_of_week);
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return NextResponse.json({ error: 'Invalid day_of_week' }, { status: 400 });
      }
      if (windowMinutes(w.start_time, w.end_time) < 60) {
        return NextResponse.json({ error: 'Each window must be at least 60 minutes' }, { status: 400 });
      }
    }

    const { error: delErr } = await supabase.from('athlete_availability').delete().eq('athlete_id', user.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (raw.length === 0) {
      return NextResponse.json({ ok: true, windows: [] });
    }

    const insertRows = raw.map((w) => ({
      athlete_id: user.id,
      day_of_week: w.day_of_week,
      start_time: padTime(w.start_time),
      end_time: padTime(w.end_time),
    }));

    const { error: insErr } = await supabase.from('athlete_availability').insert(insertRows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('coach availability weekly PUT:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
