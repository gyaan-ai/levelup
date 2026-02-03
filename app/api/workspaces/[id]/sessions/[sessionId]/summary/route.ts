import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

function isValidRating(value: unknown) {
  return typeof value === 'number' && value >= 1 && value <= 5;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: workspaceId, sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient(tenant.slug);

    const { data: summary, error } = await admin
      .from('session_summaries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(summary || null);
  } catch (e) {
    console.error('Session summary GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: workspaceId, sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const whatWeWorkedOn = typeof body.what_we_worked_on === 'string' ? body.what_we_worked_on.trim() : '';

    if (!whatWeWorkedOn || whatWeWorkedOn.length < 10) {
      return NextResponse.json(
        { error: 'What we worked on is required (min 10 characters)' },
        { status: 400 }
      );
    }

    const focusAreas = Array.isArray(body.focus_areas) ? body.focus_areas.filter((v: unknown) => typeof v === 'string') : [];
    const progressNotes = typeof body.progress_notes === 'string' ? body.progress_notes.trim() : '';
    const nextSessionPlan = typeof body.next_session_plan === 'string' ? body.next_session_plan.trim() : '';

    const overallEffort = isValidRating(body.overall_effort) ? body.overall_effort : null;
    const technicalProgress = isValidRating(body.technical_progress) ? body.technical_progress : null;

    const admin = createAdminClient(tenant.slug);

    const { data: existing } = await admin
      .from('session_summaries')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await admin
        .from('session_summaries')
        .update({
          focus_areas: focusAreas,
          what_we_worked_on: whatWeWorkedOn,
          progress_notes: progressNotes || null,
          next_session_plan: nextSessionPlan || null,
          overall_effort: overallEffort,
          technical_progress: technicalProgress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    const { data, error } = await admin
      .from('session_summaries')
      .insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        coach_id: user.id,
        focus_areas: focusAreas,
        what_we_worked_on: whatWeWorkedOn,
        progress_notes: progressNotes || null,
        next_session_plan: nextSessionPlan || null,
        overall_effort: overallEffort,
        technical_progress: technicalProgress,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    console.error('Session summary POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
