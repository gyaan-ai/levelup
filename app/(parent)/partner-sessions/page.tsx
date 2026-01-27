import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { PartnerSessionsClient } from './partner-sessions-client';

export default async function PartnerSessionsPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/partner-sessions');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'parent') redirect('/dashboard');

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id,
      scheduled_datetime,
      current_participants,
      max_participants,
      price_per_participant,
      athletes(id, first_name, last_name, school, photo_url),
      facilities(id, name, address),
      session_participants(youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level))
    `)
    .eq('session_mode', 'partner-open')
    .lt('current_participants', 2);

  const openSessions = (sessions ?? []).filter(
    (s: { current_participants?: number; max_participants?: number }) =>
      (s.current_participants ?? 1) < (s.max_participants ?? 2)
  );

  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name, age, weight_class, skill_level')
    .eq('parent_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Open Partner Sessions</h1>
        <p className="text-muted-foreground">
          Sessions where another family is looking for a partner. Request to join and train together.
        </p>
      </div>
      <PartnerSessionsClient
        initialSessions={openSessions}
        youthWrestlers={youthWrestlers ?? []}
      />
    </div>
  );
}
