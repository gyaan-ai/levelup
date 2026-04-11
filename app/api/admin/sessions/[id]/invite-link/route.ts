import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { nanoid } from 'nanoid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check user is admin or coach
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient(tenant.slug);

  // Get session's invite_token, generate if doesn't exist
  const { data: session, error } = await admin
    .from('sessions')
    .select('id, invite_token, join_policy')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  let inviteToken = session.invite_token;

  // Generate token if none exists
  if (!inviteToken) {
    inviteToken = nanoid(16);
    await admin
      .from('sessions')
      .update({ invite_token: inviteToken })
      .eq('id', sessionId);
  }

  // Build invite URL
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const inviteUrl = `${protocol}://${host}/sessions/${sessionId}?invite=${inviteToken}`;

  return NextResponse.json({
    inviteUrl,
    inviteToken,
    joinPolicy: session.join_policy,
  });
}

// POST to regenerate token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin' && userData?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient(tenant.slug);

  // Generate new token
  const inviteToken = nanoid(16);
  const { error } = await admin
    .from('sessions')
    .update({ invite_token: inviteToken })
    .eq('id', sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const protocol = host.includes('localhost') ? 'http' : 'https';
  const inviteUrl = `${protocol}://${host}/sessions/${sessionId}?invite=${inviteToken}`;

  return NextResponse.json({
    inviteUrl,
    inviteToken,
  });
}
