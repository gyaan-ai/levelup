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

  if (error) {
    console.error('Admin users fetch error:', error);
  }

  const users: AdminUserRow[] = (rows ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    last_login_at: u.last_login_at ?? null,
    archived_at: u.archived_at ?? null,
  }));

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
