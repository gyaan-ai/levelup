import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/** PATCH — admin answer. Body: { answerText: string } (empty string clears answer) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

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
    const answerText = typeof body?.answerText === 'string' ? body.answerText.trim() : null;
    if (answerText === null) return NextResponse.json({ error: 'answerText required' }, { status: 400 });

    const admin = createAdminClient(tenant.slug);
    const now = new Date().toISOString();

    if (answerText.length === 0) {
      const { data: row, error } = await admin
        .from('coach_help_questions')
        .update({
          answer_text: null,
          answered_at: null,
          answered_by: null,
        })
        .eq('id', id)
        .select('id, user_id, video_key, body, created_at, answer_text, answered_at, answered_by')
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ question: row });
    }

    const { data: row, error } = await admin
      .from('coach_help_questions')
      .update({
        answer_text: answerText,
        answered_at: now,
        answered_by: user.id,
      })
      .eq('id', id)
      .select('id, user_id, video_key, body, created_at, answer_text, answered_at, answered_by')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ question: row });
  } catch (e) {
    console.error('admin coach-help question PATCH:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
