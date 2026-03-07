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

/**
 * POST /api/admin/users/sync-emails
 * For each row in public.users, fetch the current email from Auth and update public.users if different.
 * Use this when user data (email) is wrong or out of sync with Supabase Auth.
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug);
    if (authError) return authError;

    const admin = createAdminClient(tenant.slug);
    const { data: rows, error } = await admin
      .from('users')
      .select('id, email')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const users = rows ?? [];
    let updated = 0;
    for (const row of users) {
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(row.id);
      if (authErr || !authUser?.user?.email) continue;
      const authEmail = authUser.user.email.trim();
      if (authEmail !== (row.email || '').trim()) {
        const { error: updateErr } = await admin
          .from('users')
          .update({ email: authEmail, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (!updateErr) updated += 1;
      }
    }
    return NextResponse.json({ success: true, updated, total: users.length });
  } catch (e) {
    console.error('Admin sync-emails error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
