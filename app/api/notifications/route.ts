import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const countOnly = searchParams.get('count') === 'true';

    if (countOnly) {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ count: count ?? 0 });
    }

    let query = supabase
      .from('notifications')
      .select('id, type, title, body, data, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (unreadOnly) query = query.is('read_at', null);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notifications: data ?? [] });
  } catch (e) {
    console.error('Notifications GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
