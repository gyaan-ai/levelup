import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';
import { NotificationsClient } from './notifications-client';

export default async function NotificationsPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/notifications');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  const isAthlete = userData?.role === 'athlete';

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link
        href={isAthlete ? '/athlete-dashboard' : '/dashboard'}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
      >
        ← Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bell className="h-6 w-6" />
        Notifications
      </h1>
      <NotificationsClient initialNotifications={(notifications ?? []) as Array<{ id: string; type: string; title: string; body?: string; data?: Record<string, unknown>; read_at: string | null; created_at: string }>} />
    </div>
  );
}
