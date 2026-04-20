import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

function isAllowedVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    return (
      h === 'www.loom.com' ||
      h === 'loom.com' ||
      h === 'www.youtube.com' ||
      h === 'youtube.com' ||
      h === 'youtu.be'
    );
  } catch {
    return false;
  }
}

/** GET — list resources (admin; used after mutations). */
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

    const admin = createAdminClient(tenant.slug);
    const { data: rows, error } = await admin
      .from('coach_help_resources')
      .select('id, title, url, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ resources: rows ?? [] });
  } catch (e) {
    console.error('Admin coach-help-resources GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST — add a Loom or YouTube link. Body: { title, url } */
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
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!url || !isAllowedVideoUrl(url)) {
      return NextResponse.json(
        { error: 'URL must be a Loom or YouTube watch/share link (https).' },
        { status: 400 },
      );
    }

    const admin = createAdminClient(tenant.slug);
    const { data: row, error } = await admin
      .from('coach_help_resources')
      .insert({ title, url })
      .select('id, title, url, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ resource: row });
  } catch (e) {
    console.error('Admin coach-help-resources POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
