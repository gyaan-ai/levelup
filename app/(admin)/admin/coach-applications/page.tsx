import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { CoachApplicationsClient } from './coach-applications-client';

export const dynamic = 'force-dynamic';

export default async function CoachApplicationsPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') redirect('/dashboard');

  // Use admin client to fetch all coach applications
  const admin = createAdminClient(tenant.slug);
  
  const { data: applications } = await admin
    .from('athletes')
    .select(`
      id,
      first_name,
      last_name,
      school,
      coach_type,
      bio,
      weight_class,
      status,
      active,
      safesport_certified,
      safesport_expiry,
      background_check,
      background_check_date,
      payout_method,
      venmo_handle,
      zelle_contact,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      tshirt_size,
      date_of_birth,
      agreement_signed_at,
      admin_notes,
      rejected_reason,
      created_at,
      users!inner(email, phone)
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground">Coach Applications</h1>
        <p className="text-muted-foreground">Review and approve coach applications</p>
      </div>

      <CoachApplicationsClient applications={applications || []} />
    </div>
  );
}
