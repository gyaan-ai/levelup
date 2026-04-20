import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { parseCoachHelpVideoKey } from '@/lib/coach-help-video-keys';

async function assertResourceExists(tenantSlug: string, resourceId: string): Promise<boolean> {
  const admin = createAdminClient(tenantSlug);
  const { data } = await admin.from('coach_help_resources').select('id').eq('id', resourceId).maybeSingle();
  return !!data;
}

/** GET ?videoKey= */
export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'coach' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const videoKey = req.nextUrl.searchParams.get('videoKey')?.trim() ?? '';
    const parsed = parseCoachHelpVideoKey(videoKey);
    if (!parsed) return NextResponse.json({ error: 'Invalid videoKey' }, { status: 400 });
    if (parsed.kind === 'resource') {
      const ok = await assertResourceExists(tenant.slug, parsed.id);
      if (!ok) return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from('coach_help_questions')
      .select('id, user_id, video_key, body, created_at, answer_text, answered_at, answered_by')
      .eq('video_key', videoKey)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ questions: rows ?? [] });
  } catch (e) {
    console.error('coach-help questions GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST — ask a question. Body: { videoKey, body } */
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
    if (userData?.role !== 'coach' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bodyJson = await req.json();
    const videoKey = typeof bodyJson?.videoKey === 'string' ? bodyJson.videoKey.trim() : '';
    const body = typeof bodyJson?.body === 'string' ? bodyJson.body.trim() : '';
    if (!body || body.length > 5000) {
      return NextResponse.json({ error: 'Question must be 1–5000 characters.' }, { status: 400 });
    }

    const parsed = parseCoachHelpVideoKey(videoKey);
    if (!parsed) return NextResponse.json({ error: 'Invalid videoKey' }, { status: 400 });
    if (parsed.kind === 'resource') {
      const ok = await assertResourceExists(tenant.slug, parsed.id);
      if (!ok) return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from('coach_help_questions')
      .insert({ user_id: user.id, video_key: videoKey, body })
      .select('id, user_id, video_key, body, created_at, answer_text, answered_at, answered_by')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ question: row });
  } catch (e) {
    console.error('coach-help questions POST:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
