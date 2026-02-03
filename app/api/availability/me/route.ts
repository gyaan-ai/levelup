import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { timeToHHmm } from '@/lib/availability';
import { notifyAvailabilityFollowers } from '@/lib/notify-availability-followers';

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
      .from('athlete_availability_slots')
      .select('id, slot_date, start_time, end_time')
      .eq('athlete_id', user.id)
      .gte('slot_date', new Date().toISOString().slice(0, 10))
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ availability: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const availability = (rows || []).map((r: { id: string; slot_date: string; start_time: string; end_time: string }) => ({
      id: r.id,
      slot_date: r.slot_date,
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

    const body = (await req.json()) as { slot_date: string; start_time: string; end_time: string };
    const { slot_date, start_time, end_time } = body;

    if (!slot_date || typeof slot_date !== 'string') {
      return NextResponse.json({ error: 'Invalid slot_date' }, { status: 400 });
    }
    const slotDate = slot_date.slice(0, 10);
    const d = new Date(slotDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid slot_date' }, { status: 400 });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (slotDate < today) {
      return NextResponse.json({ error: 'slot_date must be today or in the future' }, { status: 400 });
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
      .from('athlete_availability_slots')
      .insert({
        athlete_id: user.id,
        slot_date: slotDate,
        start_time: start,
        end_time: end,
      })
      .select('id, slot_date, start_time, end_time')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    notifyAvailabilityFollowers(tenant.slug, user.id);

    return NextResponse.json({
      availability: {
        id: row.id,
        slot_date: row.slot_date,
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
      .from('athlete_availability_slots')
      .delete()
      .eq('id', id)
      .eq('athlete_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    notifyAvailabilityFollowers(tenant.slug, user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Availability me DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
