import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { AdminUsersClient, type AdminUserRow } from './users-client';

export default async function AdminUsersPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') redirect('/');

  const admin = createAdminClient(tenant.slug);
  const { data: rows, error } = await admin
    .from('users')
    .select('id, email, role, created_at, last_login_at, archived_at')
    .order('created_at', { ascending: false });

  let userRows: Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    last_login_at: string | null;
    archived_at: string | null;
  }>;
  if (error && (error.message?.includes('last_login_at') || error.message?.includes('archived_at'))) {
    const { data: fallbackRows } = await admin
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });
    userRows = (fallbackRows ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
      last_login_at: null,
      archived_at: null,
    }));
  } else {
    if (error) console.error('Admin users fetch error:', error);
    userRows = (rows ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
      last_login_at: (u as { last_login_at?: string | null }).last_login_at ?? null,
      archived_at: (u as { archived_at?: string | null }).archived_at ?? null,
    }));
  }

  const athleteIds = userRows.filter((u) => u.role === 'coach').map((u) => u.id);
  const athleteMap = new Map<string, { first_name: string; last_name: string; school: string; active: boolean }>();
  if (athleteIds.length > 0) {
    const { data: athletes } = await admin
      .from('athletes')
      .select('id, first_name, last_name, school, active')
      .in('id', athleteIds);
    for (const a of athletes ?? []) {
      const row = a as { id: string; first_name?: string; last_name?: string; school?: string; active?: boolean };
      athleteMap.set(row.id, {
        first_name: row.first_name ?? '',
        last_name: row.last_name ?? '',
        school: row.school ?? '',
        active: row.active === true,
      });
    }
  }

  const parentIds = userRows.filter((u) => u.role === 'parent').map((u) => u.id);
  const kidsByParentId = new Map<string, string[]>();
  if (parentIds.length > 0) {
    const { data: primaryKids } = await admin
      .from('youth_wrestlers')
      .select('parent_id, first_name, last_name')
      .in('parent_id', parentIds)
      .eq('active', true);
    for (const k of primaryKids ?? []) {
      const row = k as { parent_id: string; first_name?: string | null; last_name?: string | null };
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || '—';
      const list = kidsByParentId.get(row.parent_id) ?? [];
      list.push(name);
      kidsByParentId.set(row.parent_id, list);
    }
    const { data: linked } = await admin
      .from('youth_wrestler_parents')
      .select('parent_id, youth_wrestler_id')
      .in('parent_id', parentIds);
    if (linked && linked.length > 0) {
      const ywIds = [...new Set((linked as { youth_wrestler_id: string }[]).map((r) => r.youth_wrestler_id))];
      const { data: ywRows } = await admin
        .from('youth_wrestlers')
        .select('id, first_name, last_name')
        .in('id', ywIds)
        .eq('active', true);
      const ywNames = new Map<string, string>();
      for (const y of ywRows ?? []) {
        const r = y as { id: string; first_name?: string | null; last_name?: string | null };
        ywNames.set(r.id, [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—');
      }
      for (const r of linked as { parent_id: string; youth_wrestler_id: string }[]) {
        const name = ywNames.get(r.youth_wrestler_id);
        if (name) {
          const list = kidsByParentId.get(r.parent_id) ?? [];
          if (!list.includes(name)) list.push(name);
          kidsByParentId.set(r.parent_id, list);
        }
      }
    }
  }

  const users: AdminUserRow[] = userRows.map((u) => {
    const profile = u.role === 'coach' ? athleteMap.get(u.id) : null;
    const display_name =
      profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || null : null;
    const kids = u.role === 'parent' ? (kidsByParentId.get(u.id) ?? []) : null;
    return {
      ...u,
      display_name: display_name ?? null,
      school: profile?.school ?? null,
      athlete_active: u.role === 'coach' ? (profile?.active ?? false) : null,
      kids_names: kids?.length ? kids : null,
    };
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← Back to Admin
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-1">
          View, edit, archive, and delete users. Sort and filter by role.
        </p>
      </div>
      <AdminUsersClient initialUsers={users} />
    </div>
  );
}
