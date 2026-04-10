import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { BackLink } from '@/components/back-link';
import { FocusAreasClient } from './focus-areas-client';

export default async function AdminFocusAreasPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') redirect('/admin');

  let focusAreas: { id: string; name: string; sort_order: number }[] = [];
  try {
    const admin = createAdminClient(tenant.slug);
    const { data: rows } = await admin
      .from('session_focus_areas')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true });
    focusAreas = (rows ?? []).map((r: { id: string; name: string; sort_order: number }) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
    }));
  } catch {
    focusAreas = [];
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <div className="mb-4 -ml-2">
        <BackLink
          fallbackHref="/admin"
          label="Back to Admin"
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        />
      </div>
      <h1 className="text-2xl font-bold mb-1">Session topics</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Add or edit topics here. They appear when creating or editing a small group session (you can choose up to 2 focus areas per session). Use <strong>Admin → Create session</strong> or <strong>Edit</strong> on a session to set focus areas.
      </p>
      <FocusAreasClient initialList={focusAreas} />
    </div>
  );
}
