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

/** GET ?videoKey= — my view count, aggregate thumbs, my vote */
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

    const { count: myViewCount, error: countErr } = await supabase
      .from('coach_help_views')
      .select('*', { count: 'exact', head: true })
      .eq('video_key', videoKey)
      .eq('user_id', user.id);

    if (countErr) {
      console.error('coach_help_views count:', countErr.message);
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const { data: voteRow } = await supabase
      .from('coach_help_votes')
      .select('vote')
      .eq('video_key', videoKey)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: summaryRows, error: rpcErr } = await supabase.rpc('coach_help_vote_summary', {
      p_video_key: videoKey,
    });

    if (rpcErr) {
      console.error('coach_help_vote_summary:', rpcErr.message);
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    const row = Array.isArray(summaryRows) && summaryRows[0] ? summaryRows[0] : { up_count: 0, down_count: 0 };

    return NextResponse.json({
      myViewCount: myViewCount ?? 0,
      upCount: Number(row.up_count ?? 0),
      downCount: Number(row.down_count ?? 0),
      myVote: voteRow?.vote ?? null,
    });
  } catch (e) {
    console.error('coach-help summary GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
