import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { dbForCoachActor, resolveCoachActorId } from '@/lib/coach-actor-server';

export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const actor = await resolveCoachActorId(supabase, user.id);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await supabase
      .from('athlete_availability_blocks')
      .select('id, blocked_date, reason')
      .eq('athlete_id', actor.coachId)
      .gte('blocked_date', today)
      .order('blocked_date', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ blocks: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ blocks: rows ?? [] });
  } catch (e) {
    console.error('coach availability blocks GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const actor = await resolveCoachActorId(supabase, user.id);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const db = dbForCoachActor(tenant.slug, actor, supabase);

    const body = (await req.json()) as { blocked_date?: string; reason?: string | null };
    const bd = body.blocked_date?.trim().slice(0, 10);
    if (!bd) return NextResponse.json({ error: 'blocked_date required' }, { status: 400 });

    const { error } = await db.from('athlete_availability_blocks').insert({
      athlete_id: actor.coachId,
      blocked_date: bd,
      reason: body.reason?.trim() || null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('coach availability blocks POST:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const actor = await resolveCoachActorId(supabase, user.id);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const db = dbForCoachActor(tenant.slug, actor, supabase);

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await db.from('athlete_availability_blocks').delete().eq('id', id).eq('athlete_id', actor.coachId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('coach availability blocks DELETE:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
