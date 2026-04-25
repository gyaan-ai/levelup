import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function POST(req: NextRequest) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'parent' && userData?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    announcementType?: string;
    referenceId?: string;
  };
  const announcementType = body.announcementType?.trim();
  const referenceId = body.referenceId?.trim();
  if (announcementType !== 'new_coach' && announcementType !== 'new_location') {
    return NextResponse.json({ error: 'Invalid announcementType' }, { status: 400 });
  }
  if (!referenceId) return NextResponse.json({ error: 'Missing referenceId' }, { status: 400 });

  const { error } = await supabase.from('parent_announcement_dismissals').insert({
    parent_id: user.id,
    announcement_type: announcementType,
    reference_id: referenceId,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true });
    }
    console.error('parent announcement dismiss:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
