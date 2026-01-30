import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(req: NextRequest) {
  try {
    const host = (await headers()).get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await supabase
      .from('coach_follows')
      .select('coach_id, created_at, athletes(id, first_name, last_name, school, photo_url)')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Array<{
      coach_id: string;
      created_at: string;
      athletes?: { id: string; first_name: string; last_name: string; school: string; photo_url?: string } | { id: string; first_name: string; last_name: string; school: string; photo_url?: string }[];
    }>;
    const follows = rows.map((f) => {
      const a = Array.isArray(f.athletes) ? f.athletes[0] : f.athletes;
      return {
        coachId: f.coach_id,
        followedAt: f.created_at,
        coach: a ? { id: a.id, firstName: a.first_name, lastName: a.last_name, school: a.school, photoUrl: a.photo_url } : null,
      };
    });
    return NextResponse.json({ follows });
  } catch (e) {
    console.error('Coach follows GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const host = (await headers()).get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { coachId?: string };
    const coachId = body?.coachId;
    if (!coachId || typeof coachId !== 'string') {
      return NextResponse.json({ error: 'Missing coachId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('coach_follows')
      .upsert(
        { parent_id: user.id, coach_id: coachId },
        { onConflict: 'parent_id,coach_id' }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Coach follows POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const host = (await headers()).get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get('coachId');
    if (!coachId) return NextResponse.json({ error: 'Missing coachId' }, { status: 400 });

    const { error } = await supabase
      .from('coach_follows')
      .delete()
      .eq('parent_id', user.id)
      .eq('coach_id', coachId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Coach follows DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
