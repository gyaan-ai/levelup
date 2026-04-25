import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

async function requireAdmin(tenantSlug: string) {
  const supabase = await createClient(tenantSlug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return {};
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await requireAdmin(tenant.slug);
    if ('error' in auth) return auth.error;

    const body = (await req.json()) as {
      headline?: string;
      cta_label?: string;
      cta_path?: string;
      expires_at?: string;
    };

    const updates: Record<string, string> = {};
    if (body.headline != null) {
      const h = String(body.headline).trim();
      if (!h) return NextResponse.json({ error: 'headline cannot be empty' }, { status: 400 });
      updates.headline = h;
    }
    if (body.cta_label != null) {
      updates.cta_label = String(body.cta_label).trim().slice(0, 120) || 'View Profile';
    }
    if (body.cta_path != null) {
      const p = String(body.cta_path).trim();
      if (!p) return NextResponse.json({ error: 'cta_path cannot be empty' }, { status: 400 });
      updates.cta_path = p.startsWith('/') ? p : `/${p}`;
    }
    if (body.expires_at != null) {
      const exp = new Date(String(body.expires_at).trim());
      if (Number.isNaN(exp.getTime())) {
        return NextResponse.json({ error: 'expires_at must be a valid date' }, { status: 400 });
      }
      updates.expires_at = exp.toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: row, error } = await admin
      .from('parent_announcements')
      .update(updates)
      .eq('id', id)
      .select('id, announcement_type, reference_id, headline, cta_label, cta_path, created_at, expires_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error('admin parent-announcements PATCH', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await requireAdmin(tenant.slug);
    if ('error' in auth) return auth.error;

    const admin = createAdminClient(tenant.slug);
    const { error } = await admin.from('parent_announcements').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('admin parent-announcements DELETE', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
