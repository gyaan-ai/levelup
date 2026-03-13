import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { BookingFlow } from './booking-flow';

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ youthWrestlerId?: string }>;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const preselectedYouthWrestlerId = sp.youthWrestlerId ?? null;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    notFound();
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);
  const loginRedirect = '/login?redirect=' + encodeURIComponent('/book/' + athleteId);

  // Check authentication (handle invalid/expired refresh token gracefully)
  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      redirect(loginRedirect);
    }
    user = data?.user ?? null;
  } catch {
    redirect(loginRedirect);
  }

  if (!user) {
    redirect(loginRedirect);
  }

  // Check user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role === 'athlete') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/browse');
  // parent and admin can both book (admin can test flow)

  // Fetch athlete data
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, school, photo_url, facility_id, total_sessions')
    .eq('id', athleteId)
    .eq('active', true)
    .single();

  if (athleteError || !athlete) {
    notFound();
  }

  // Fetch parent's youth wrestlers
  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .eq('parent_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (!youthWrestlers || youthWrestlers.length === 0) {
    redirect('/wrestlers/add?redirect=' + encodeURIComponent('/book/' + athleteId));
  }

  // Get facility info if available
  let facility = null;
  if (athlete.facility_id) {
    const { data: facilityData } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', athlete.facility_id)
      .single();
    facility = facilityData;
  }

  // Prefer coach-built services; else org products
  const admin = createAdminClient(tenantSlug);
  const { data: coachServices } = await admin
    .from('athlete_services')
    .select('id, duration_minutes, session_type, max_participants, parent_price, athlete_payout, display_order')
    .eq('athlete_id', athleteId)
    .eq('active', true)
    .order('display_order', { ascending: true })
    .order('duration_minutes', { ascending: true });

  let products: Array<{ id: string; slug: string; name: string; parent_price: number; athlete_payout: number; min_participants: number; max_participants: number }> = [];

  if (coachServices && coachServices.length > 0) {
    const durationLabel = (m: number) => m === 30 ? '30 min' : m === 60 ? '1 hr' : m === 90 ? '1 hr 30 min' : m === 120 ? '2 hr' : `${m} min`;
    const typeLabel = (t: string) => t === 'private' ? 'Private (1:1)' : t === 'partner' ? 'Partner (1:2)' : 'Small group';
    products = coachServices.map((s) => ({
      id: s.id,
      slug: `service-${s.id}`,
      name: `${durationLabel(s.duration_minutes)} · ${typeLabel(s.session_type)}${s.session_type === 'small_group' ? ` (up to ${s.max_participants})` : ''}`,
      parent_price: Number(s.parent_price),
      athlete_payout: Number(s.athlete_payout),
      min_participants: s.session_type === 'private' ? 1 : s.session_type === 'partner' ? 2 : 3,
      max_participants: s.max_participants,
    }));
  } else {
    const { data: allProducts } = await admin
      .from('products')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });
    const { data: athleteProducts } = await admin
      .from('athlete_products')
      .select('product_id, enabled')
      .eq('athlete_id', athleteId);
    const disabledProductIds = new Set(
      (athleteProducts || []).filter(ap => ap.enabled === false).map(ap => ap.product_id)
    );
    products = (allProducts || []).filter(p => !disabledProductIds.has(p.id));
  }

  return (
    <BookingFlow
      athlete={athlete}
      facility={facility}
      youthWrestlers={youthWrestlers || []}
      tenantPricing={tenant.pricing}
      products={products}
      preselectedYouthWrestlerId={preselectedYouthWrestlerId}
    />
  );
}





