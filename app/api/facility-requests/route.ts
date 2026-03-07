import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

// Coach (athlete) submits a request for a facility not on the list
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
    if (userData?.role !== 'athlete') return NextResponse.json({ error: 'Only coaches can request facilities' }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { name?: string; school?: string; address?: string };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const school = typeof body.school === 'string' ? body.school.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() || null : null;

    if (!name || !school) return NextResponse.json({ error: 'Name and school are required' }, { status: 400 });

    // Ensure athlete row exists (onboarding may have created user but not athlete yet)
    const { data: athlete } = await supabase.from('athletes').select('id').eq('id', user.id).single();
    if (!athlete) return NextResponse.json({ error: 'Athlete profile not found' }, { status: 400 });

    const { data: row, error } = await supabase
      .from('facility_requests')
      .insert({
        requested_by_athlete_id: user.id,
        name,
        school,
        address,
        status: 'pending',
      })
      .select('id, name, school, status, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: row, message: 'Request submitted for admin approval.' });
  } catch (e) {
    console.error('Facility request POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
