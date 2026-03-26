import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function POST(req: NextRequest) {
  try {
    const hostname = req.headers.get('host') || '';
    const tenant = getTenantByDomain(hostname);
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Verify admin user
    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { coachId, reason, adminNotes } = body;

    if (!coachId) {
      return NextResponse.json({ error: 'Coach ID is required' }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);

    // Get the coach's current data
    const { data: coach, error: coachError } = await admin
      .from('athletes')
      .select('id, first_name, last_name, status')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    if (coach.status !== 'pending') {
      return NextResponse.json({ error: 'Coach is not in pending status' }, { status: 400 });
    }

    // Reject the coach
    const { error: updateError } = await admin
      .from('athletes')
      .update({
        status: 'rejected',
        active: false,
        rejected_reason: reason.trim(),
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    if (updateError) {
      return NextResponse.json({ error: `Failed to reject: ${updateError.message}` }, { status: 500 });
    }

    // Get email for notification
    const { data: coachUser } = await admin
      .from('users')
      .select('email')
      .eq('id', coachId)
      .single();

    // TODO: Send rejection email to coach
    // await sendRejectionEmail(coachUser?.email, coach.first_name, reason);

    return NextResponse.json({
      success: true,
      message: `${coach.first_name} ${coach.last_name} has been rejected`,
    });
  } catch (error) {
    console.error('Reject coach error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
