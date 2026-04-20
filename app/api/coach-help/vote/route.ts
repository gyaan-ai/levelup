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

/** POST — set vote (1, -1) or clear (0). Body: { videoKey, vote: 1 | -1 | 0 } */
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

    const body = await req.json();
    const videoKey = typeof body?.videoKey === 'string' ? body.videoKey.trim() : '';
    const voteRaw = body?.vote;
    const vote = voteRaw === 1 || voteRaw === -1 || voteRaw === 0 ? voteRaw : null;
    if (vote === null) return NextResponse.json({ error: 'vote must be 1, -1, or 0' }, { status: 400 });

    const parsed = parseCoachHelpVideoKey(videoKey);
    if (!parsed) return NextResponse.json({ error: 'Invalid videoKey' }, { status: 400 });
    if (parsed.kind === 'resource') {
      const ok = await assertResourceExists(tenant.slug, parsed.id);
      if (!ok) return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }

    if (vote === 0) {
      const { error } = await supabase.from('coach_help_votes').delete().eq('user_id', user.id).eq('video_key', videoKey);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from('coach_help_votes').upsert(
        { user_id: user.id, video_key: videoKey, vote, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,video_key' },
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('coach-help vote POST:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
