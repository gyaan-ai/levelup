import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

async function requireAdmin(tenantSlug: string) {
  const supabase = await createClient(tenantSlug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

/** GET - list all youth wrestlers (kids) for admin. */
export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug);
    if (authError) return authError;

    const admin = createAdminClient(tenant.slug);
    const { data: kids, error } = await admin
      .from('youth_wrestlers')
      .select('id, first_name, last_name, school, weight_class, skill_level, graduation_year, parent_id, photo_url, created_at')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const parentIds = [...new Set((kids ?? []).map((k) => k.parent_id))];
    const parentEmails = new Map<string, string>();
    if (parentIds.length > 0) {
      const { data: users } = await admin
        .from('users')
        .select('id, email')
        .in('id', parentIds);
      for (const u of users ?? []) {
        parentEmails.set(u.id, u.email ?? '—');
      }
    }

    const list = (kids ?? []).map((k) => ({
      id: k.id,
      first_name: k.first_name,
      last_name: k.last_name,
      school: k.school ?? null,
      weight_class: k.weight_class ?? null,
      skill_level: k.skill_level ?? null,
      graduation_year: k.graduation_year ?? null,
      parent_id: k.parent_id,
      parent_email: parentEmails.get(k.parent_id) ?? '—',
      photo_url: k.photo_url ?? null,
      created_at: k.created_at,
    }));

    return NextResponse.json({ youthWrestlers: list });
  } catch (e) {
    console.error('Admin youth-wrestlers GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
