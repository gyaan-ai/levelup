import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function GET() {
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

  // Check if admin viewing as coach
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const cookieStore = await cookies();
  const viewAsCoachId = userData?.role === 'admin' 
    ? cookieStore.get('levelup_view_as_coach_id')?.value 
    : null;
  
  const coachId = viewAsCoachId || user.id;

  // Get coach info
  const { data: coach } = await supabase
    .from('athletes')
    .select('first_name')
    .eq('id', coachId)
    .single();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. New bookings (last 48h) - need to welcome
  const { data: newBookings } = await supabase
    .from('session_registrations')
    .select(`
      id,
      created_at,
      session_id,
      youth_wrestler_id,
      parent_id,
      sessions!inner (
        id,
        scheduled_datetime,
        athlete_id,
        facilities (name)
      ),
      youth_wrestlers (
        id,
        first_name,
        last_name,
        phone,
        date_of_birth
      ),
      users (
        id,
        first_name,
        last_name,
        phone
      )
    `)
    .eq('sessions.athlete_id', coachId)
    .eq('status', 'confirmed')
    .gte('created_at', twoDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  // 2. Pre-session reminders (sessions in next 24h)
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select(`
      id,
      scheduled_datetime,
      facilities (name),
      session_registrations (
        id,
        youth_wrestler_id,
        parent_id,
        youth_wrestlers (
          id,
          first_name,
          last_name,
          phone
        ),
        users (
          id,
          first_name,
          last_name,
          phone
        )
      )
    `)
    .eq('athlete_id', coachId)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', now.toISOString())
    .lte('scheduled_datetime', tomorrow.toISOString())
    .order('scheduled_datetime', { ascending: true });

  // 3. Post-session follow-ups (completed last 48h)
  const { data: recentlyCompleted } = await supabase
    .from('sessions')
    .select(`
      id,
      scheduled_datetime,
      completed_at,
      facilities (name),
      session_registrations (
        id,
        youth_wrestler_id,
        parent_id,
        youth_wrestlers (
          id,
          first_name,
          last_name,
          phone
        ),
        users (
          id,
          first_name,
          last_name,
          phone
        )
      )
    `)
    .eq('athlete_id', coachId)
    .eq('status', 'completed')
    .gte('completed_at', twoDaysAgo.toISOString())
    .order('completed_at', { ascending: false });

  // 4. Upcoming birthdays (next 7 days)
  const { data: allAthletes } = await supabase
    .from('session_registrations')
    .select(`
      youth_wrestler_id,
      youth_wrestlers (
        id,
        first_name,
        last_name,
        phone,
        date_of_birth
      )
    `)
    .eq('status', 'confirmed')
    .not('youth_wrestlers.date_of_birth', 'is', null);

  // Filter birthdays in next 7 days
  const upcomingBirthdays = (allAthletes ?? [])
    .filter(reg => {
      const athlete = Array.isArray(reg.youth_wrestlers) ? reg.youth_wrestlers[0] : reg.youth_wrestlers;
      if (!athlete?.date_of_birth) return false;
      
      const dob = new Date(athlete.date_of_birth);
      const thisYearBday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (thisYearBday < now) {
        thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
      }
      const daysUntil = Math.ceil((thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 7;
    })
    .map(reg => {
      const athlete = Array.isArray(reg.youth_wrestlers) ? reg.youth_wrestlers[0] : reg.youth_wrestlers;
      return athlete;
    })
    .filter((v, i, a) => a.findIndex(t => t?.id === v?.id) === i); // Dedupe

  // Get existing playbook actions to mark what's been done
  const { data: existingActions } = await supabase
    .from('playbook_actions')
    .select('*')
    .eq('coach_id', coachId)
    .gte('actioned_at', twoDaysAgo.toISOString());

  // Helper to check if action was taken
  const wasActioned = (sessionId: string | null, registrationId: string | null, actionType: string) => {
    return (existingActions ?? []).some(a => 
      (sessionId && a.session_id === sessionId && a.action_type === actionType) ||
      (registrationId && a.registration_id === registrationId && a.action_type === actionType)
    );
  };

  return NextResponse.json({
    coachFirstName: coach?.first_name ?? 'Coach',
    newBookings: (newBookings ?? []).map(b => ({
      ...b,
      welcomed: wasActioned(b.session_id, b.id, 'welcome'),
    })),
    preSessionReminders: (upcomingSessions ?? []).map(s => ({
      ...s,
      reminded: wasActioned(s.id, null, 'pre_session'),
    })),
    postSessionFollowups: (recentlyCompleted ?? []).map(s => ({
      ...s,
      followedUp: wasActioned(s.id, null, 'post_session'),
    })),
    upcomingBirthdays: upcomingBirthdays.map(a => ({
      ...a,
      wished: (existingActions ?? []).some(
        act => act.contact_id === a?.id && act.action_type === 'birthday'
      ),
    })),
  });
}

// POST to record an action
export async function POST(request: Request) {
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

  const body = await request.json();
  const { sessionId, registrationId, contactType, contactId, actionType } = body;

  const { error } = await supabase
    .from('playbook_actions')
    .insert({
      coach_id: user.id,
      session_id: sessionId || null,
      registration_id: registrationId || null,
      contact_type: contactType,
      contact_id: contactId || null,
      action_type: actionType,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
