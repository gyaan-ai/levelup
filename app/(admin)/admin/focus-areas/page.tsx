import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
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
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
      </Link>
      <h1 className="text-2xl font-bold mb-1">Session topics</h1>
      <p className="text-muted-foreground text-sm mb-6">
        These appear in the dropdown when creating or editing a group session. Add, rename, or remove topics.
      </p>
      <FocusAreasClient initialList={focusAreas} />
    </div>
  );
}
