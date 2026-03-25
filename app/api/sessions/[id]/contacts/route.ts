import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) {
    return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 });
  }

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify this session belongs to the requesting coach (or user is admin)
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: session } = await supabase
    .from('sessions')
    .select('athlete_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Only allow coach who owns the session or admin
  if (userData?.role !== 'admin' && session.athlete_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all participants for this session with athlete and parent info
  const { data: participants, error } = await supabase
    .from('session_participants')
    .select(`
      id,
      youth_wrestler_id,
      parent_id,
      youth_wrestlers (
        id,
        first_name,
        last_name,
        phone,
        date_of_birth,
        weight_class
      ),
      users (
        id,
        first_name,
        last_name,
        phone
      )
    `)
    .eq('session_id', sessionId)
    .in('status', ['confirmed', 'pending', 'booked']);

  if (error) {
    console.log('[v0] contacts API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[v0] participants found:', participants?.length, participants);

  // Format the contacts
  const contacts = (participants ?? []).map((reg) => {
    const athlete = Array.isArray(reg.youth_wrestlers) ? reg.youth_wrestlers[0] : reg.youth_wrestlers;
    const parent = Array.isArray(reg.users) ? reg.users[0] : reg.users;

    return {
      participantId: reg.id,
      athlete: athlete ? {
        id: athlete.id,
        firstName: athlete.first_name,
        lastName: athlete.last_name,
        phone: athlete.phone,
        dateOfBirth: athlete.date_of_birth,
        weightClass: athlete.weight_class,
      } : null,
      parent: parent ? {
        id: parent.id,
        firstName: parent.first_name,
        lastName: parent.last_name,
        phone: parent.phone,
      } : null,
    };
  });

  return NextResponse.json({ contacts });
}
