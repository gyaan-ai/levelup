import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

const SELECT_FIELDS = `
  id,
  requesting_parent_id,
  youth_wrestler_id,
  coach_id,
  facility_id,
  preferred_datetime,
  session_type,
  duration_minutes,
  counter_preferred_datetime,
  counter_note,
  payment_deadline_at,
  message,
  flexibility_note,
  status,
  coach_response,
  created_session_id,
  responded_at,
  created_at,
  updated_at,
  youth_wrestlers:youth_wrestler_id(id, first_name, last_name, age, weight_class),
  athletes:coach_id(id, first_name, last_name, school, photo_url),
  facilities:facility_id(id, name)
`;

export async function GET() {
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
    const role = userData?.role;

    let q = supabase.from('parent_session_requests').select(SELECT_FIELDS).order('created_at', { ascending: false });

    if (role === 'parent') {
      q = q.eq('requesting_parent_id', user.id);
    } else if (role === 'coach') {
      q = q.eq('coach_id', user.id);
    } else if (role === 'admin') {
      // Admins testing: no global list; use coach view if they have athlete row, else empty
      const { data: ath } = await supabase.from('athletes').select('id').eq('id', user.id).maybeSingle();
      if (ath) q = q.eq('coach_id', user.id);
      else return NextResponse.json({ requests: [] });
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ requests: data ?? [] });
  } catch (e) {
    console.error('parent-session-requests GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
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
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Only parents can request sessions' }, { status: 403 });
    }

    return NextResponse.json(
      {
        error:
          "Custom session requests are no longer available. Book a time from the coach's published availability instead.",
      },
      { status: 403 }
    );
  } catch (e) {
    console.error('parent-session-requests POST:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
