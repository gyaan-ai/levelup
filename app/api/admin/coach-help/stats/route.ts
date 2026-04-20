import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET — engagement by video_key (admin only). */
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
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: rows, error } = await supabase.rpc('coach_help_admin_engagement_stats');

    if (error) {
      console.error('coach_help_admin_engagement_stats:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stats: rows ?? [] });
  } catch (e) {
    console.error('admin coach-help stats GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
