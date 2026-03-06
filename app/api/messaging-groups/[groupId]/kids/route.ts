import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** POST - add a kid (youth wrestler) to the group. Coach only. Body: { youthWrestlerId } */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: group } = await supabase
      .from('messaging_groups')
      .select('athlete_id')
      .eq('id', groupId)
      .single();
    if (!group || group.athlete_id !== user.id) {
      return NextResponse.json({ error: 'Only the group coach can add kids' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const youthWrestlerId = body.youthWrestlerId ?? body.youth_wrestler_id;
    if (!youthWrestlerId) {
      return NextResponse.json({ error: 'youthWrestlerId is required' }, { status: 400 });
    }

    const { data: yw } = await supabase
      .from('youth_wrestlers')
      .select('id, parent_id')
      .eq('id', youthWrestlerId)
      .single();
    if (!yw) return NextResponse.json({ error: 'Youth wrestler not found' }, { status: 404 });

    await supabase.from('messaging_group_kids').insert({
      group_id: groupId,
      youth_wrestler_id: youthWrestlerId,
    });

    if (yw.parent_id) {
      await supabase.from('messaging_group_members').upsert(
        {
          group_id: groupId,
          user_id: yw.parent_id,
          role: 'member',
        },
        { onConflict: 'group_id,user_id' }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Messaging group add kid error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
