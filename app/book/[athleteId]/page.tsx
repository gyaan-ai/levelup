import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { checkoutAllowSavedAccountPercent } from '@/lib/checkout-promo';
import { getRecommendedPricesForCoach } from '@/lib/coach-session-pricing';
import { coachPayoutFromParentPrice } from '@/lib/pricing';
import { BookingFlow } from './booking-flow';
import {
  CoachUpcomingSessionsSection,
  type CoachSessionForBookList,
} from './coach-upcoming-sessions-section';

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ youthWrestlerId?: string; date?: string; time?: string }>;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const preselectedYouthWrestlerId = sp.youthWrestlerId ?? null;
  const dateRaw = sp.date?.trim();
  const initialBookingDate =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;
  const timeRaw = sp.time?.trim();
  const timeMatch = timeRaw?.match(/^(\d{1,2}):(\d{2})$/);
  const initialBookingTime = (() => {
    if (!timeMatch) return null;
    const h = parseInt(timeMatch[1], 10);
    const min = parseInt(timeMatch[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  })();
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

  if (userData?.role === 'coach') redirect('/athlete-dashboard');
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

  // When parent has no wrestlers, still render the book page so "See availability" lands here;
  // BookingFlow will show an "Add your wrestler to book" CTA instead of redirecting away.
  const youthWrestlersList = youthWrestlers ?? [];

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

  // Pricing: prefer coach rate card (`athlete_services`); otherwise Guild product defaults with
  // per-coach overrides from `athlete_products` (same as getRecommendedPricesForCoach / profile).
  const admin = createAdminClient(tenantSlug);
  const recommendedByType = await getRecommendedPricesForCoach(admin, athleteId);

  const { data: coachServicesRaw } = await admin
    .from('athlete_services')
    .select('id, duration_minutes, session_type, max_participants, parent_price, athlete_payout, display_order')
    .eq('athlete_id', athleteId)
    .eq('active', true)
    .order('display_order', { ascending: true });

  /** Prefer 60m tier first within each session type so booking "Choose Session Type" uses Guild-standard headline prices. */
  const coachServices = (coachServicesRaw ?? []).slice().sort((a, b) => {
    const oa = a.display_order ?? 0;
    const ob = b.display_order ?? 0;
    if (oa !== ob) return oa - ob;
    if (a.session_type !== b.session_type) return String(a.session_type).localeCompare(String(b.session_type));
    const rank = (m: number) => (m === 60 ? 0 : m === 30 ? 1 : m === 90 ? 2 : m === 120 ? 3 : 9);
    return rank(a.duration_minutes) - rank(b.duration_minutes);
  });

  let products: Array<{ id: string; slug: string; name: string; parent_price: number; athlete_payout: number; min_participants: number; max_participants: number }> = [];

  if (coachServices.length > 0) {
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
    const recommendedParentForSlug = (slug: string): number | undefined => {
      if (slug === 'private') return recommendedByType.private;
      if (slug === 'partner') return recommendedByType.partner;
      if (slug === 'small-group') return recommendedByType.small_group;
      return undefined;
    };
    products = (allProducts || [])
      .filter((p) => !disabledProductIds.has(p.id))
      .map((p) => {
        const rec = recommendedParentForSlug(p.slug);
        const parent_price = rec ?? Number(p.parent_price);
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          parent_price,
          athlete_payout: coachPayoutFromParentPrice(parent_price),
          min_participants: p.min_participants,
          max_participants: p.max_participants,
        };
      });
  }

  const nowISO = new Date().toISOString();
  const { data: coachSessionRows } = await admin
    .from('sessions')
    .select(
      `
      id,
      scheduled_datetime,
      session_type,
      session_mode,
      join_policy,
      focus_area,
      current_participants,
      max_participants,
      price_per_participant,
      partner_invite_code,
      facilities:facility_id(name)
    `
    )
    .eq('athlete_id', athleteId)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', nowISO)
    .order('scheduled_datetime', { ascending: true })
    .limit(200);

  const sessionsBase = (coachSessionRows ?? []) as Omit<CoachSessionForBookList, 'session_participants'>[];
  const coachSessionIds = sessionsBase.map((s) => s.id);
  const participantsBySessionId = new Map<string, unknown[]>();
  if (coachSessionIds.length > 0) {
    const { data: partRows } = await admin
      .from('session_participants')
      .select(
        `
        session_id,
        roster_first_name,
        roster_last_name,
        youth_wrestlers ( first_name, last_name )
      `
      )
      .in('session_id', coachSessionIds);
    for (const raw of partRows ?? []) {
      const sid = (raw as { session_id?: string }).session_id;
      if (!sid) continue;
      const list = participantsBySessionId.get(sid) ?? [];
      list.push(raw);
      participantsBySessionId.set(sid, list);
    }
  }
  const coachSessionsForBook: CoachSessionForBookList[] = sessionsBase.map((s) => ({
    ...s,
    session_participants: participantsBySessionId.get(s.id) ?? [],
  }));

  return (
    <>
      <CoachUpcomingSessionsSection
        coachFirstName={athlete.first_name}
        sessions={coachSessionsForBook}
        preselectedYouthWrestlerId={preselectedYouthWrestlerId}
      />
      <BookingFlow
        athlete={athlete}
        facility={facility}
        youthWrestlers={youthWrestlersList}
        tenantPricing={tenant.pricing}
        products={products}
        preselectedYouthWrestlerId={preselectedYouthWrestlerId}
        checkoutUsesSavedAccountDiscount={checkoutAllowSavedAccountPercent()}
        initialBookingDate={initialBookingDate}
        initialBookingTime={initialBookingTime}
      />
    </>
  );
}





