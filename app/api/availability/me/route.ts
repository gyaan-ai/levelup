import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { timeToHHmm } from '@/lib/availability';

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
    if (userData?.role !== 'athlete') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: rows, error } = await supabase
      .from('athlete_availability')
      .select('id, day_of_week, start_time, end_time')
      .eq('athlete_id', user.id)
      .order('day_of_week')
      .order('start_time');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const availability = (rows || []).map((r: { id: string; day_of_week: number; start_time: string; end_time: string }) => ({
      id: r.id,
      day_of_week: r.day_of_week,
      start_time: timeToHHmm(r.start_time),
      end_time: timeToHHmm(r.end_time),
    }));

    return NextResponse.json({ availability });
  } catch (e) {
    console.error('Availability me GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'athlete') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { day_of_week: number; start_time: string; end_time: string };
    const { day_of_week, start_time, end_time } = body;

    if (typeof day_of_week !== 'number' || day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: 'Invalid day_of_week' }, { status: 400 });
    }
    if (!start_time || !end_time || typeof start_time !== 'string' || typeof end_time !== 'string') {
      return NextResponse.json({ error: 'Invalid start_time or end_time' }, { status: 400 });
    }

    const pad = (t: string) => {
      const s = t.trim();
      if (!s) return '09:00:00';
      const parts = s.split(':');
      const h = String(parseInt(parts[0] || '0', 10) || 0).padStart(2, '0');
      const m = String(parseInt(parts[1] || '0', 10) || 0).padStart(2, '0');
      const sec = parts[2] != null ? String(parseInt(parts[2], 10) || 0).padStart(2, '0') : '00';
      return `${h}:${m}:${sec}`;
    };
    const start = pad(start_time);
    const end = pad(end_time);

    const { data: row, error } = await supabase
      .from('athlete_availability')
      .insert({
        athlete_id: user.id,
        day_of_week,
        start_time: start,
        end_time: end,
      })
      .select('id, day_of_week, start_time, end_time')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      availability: {
        id: row.id,
        day_of_week: row.day_of_week,
        start_time: timeToHHmm(row.start_time),
        end_time: timeToHHmm(row.end_time),
      },
    });
  } catch (e) {
    console.error('Availability me POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'athlete') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
      .from('athlete_availability')
      .delete()
      .eq('id', id)
      .eq('athlete_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Availability me DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
