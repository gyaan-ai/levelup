import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import Link from 'next/link';
import { VIEW_AS_COOKIE_NAME } from '@/lib/auth/view-as-cookie';
import { getParentYouthWrestlerIds } from '@/lib/parent-wrestlers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Button } from '@/components/ui/button';
import { YouthWrestler } from '@/types';
import { formatEST } from '@/lib/format-date';
import { getSessionTypeDisplay } from '@/components/session-type-badge';
import { ensureAutoFamilyDiscountForParent } from '@/lib/family-auto-discount';
import { checkoutAllowSavedAccountPercent } from '@/lib/checkout-promo';
import { getUserCreditBalance } from '@/lib/credits';
import { isSessionOpenForParentBrowse } from '@/lib/sessions';
import { ParentHomeReviewsSection } from '@/components/parent-home-reviews-section';
import { ParentHomeDiscoverySection } from '@/components/parent-home-discovery-section';
import type { ReviewSessionPayload } from '@/components/parent-home-review-sheet';
import type { DiscoverySession } from '@/components/home-discovery-session-card';

export const dynamic = 'force-dynamic';

const DISCOVERY_SELECT = `
  id, scheduled_datetime, session_type, session_mode, join_policy,
  current_participants, max_participants, price_per_participant, duration_minutes,
  athlete_id, facility_id,
  athletes:athlete_id(id, first_name, last_name, school, photo_url, average_rating, review_count),
  facilities:facility_id(id, name),
  session_participants(id, youth_wrestler_id, youth_wrestlers:youth_wrestler_id(id, first_name, last_name))
`;

async function fetchDiscoverySessions(
  admin: ReturnType<typeof createAdminClient>,
  parentId: string,
  nowIso: string
): Promise<DiscoverySession[]> {
  const { data: follows } = await admin.from('coach_follows').select('coach_id').eq('parent_id', parentId);
  const followedIds = [...new Set((follows ?? []).map((f: { coach_id: string }) => f.coach_id))];

  const runQuery = async (restrictToCoaches: string[] | null) => {
    let q = admin
      .from('sessions')
      .select(DISCOVERY_SELECT)
      .eq('join_policy', 'public')
      .in('status', ['scheduled', 'pending_payment'])
      .gte('scheduled_datetime', nowIso)
      .order('scheduled_datetime', { ascending: true })
      .limit(24);
    if (restrictToCoaches && restrictToCoaches.length > 0) {
      q = q.in('athlete_id', restrictToCoaches);
    }
    const { data } = await q;
    return (data ?? []) as unknown as DiscoverySession[];
  };

  const first = await runQuery(followedIds.length > 0 ? followedIds : null);
  const filteredFirst = first.filter((s) => isSessionOpenForParentBrowse(s));
  const out: DiscoverySession[] = filteredFirst.slice(0, 3);
  const seen = new Set(out.map((s) => s.id));

  if (out.length < 3) {
    const second = await runQuery(null);
    for (const s of second) {
      if (out.length >= 3) break;
      if (seen.has(s.id)) continue;
      if (!isSessionOpenForParentBrowse(s)) continue;
      out.push(s as DiscoverySession);
      seen.add(s.id);
    }
  }

  return out.slice(0, 3);
}

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('first_name, role').eq('id', user.id).single();
  if (userData?.role === 'coach') redirect('/athlete-dashboard');

  const isAdmin = userData?.role === 'admin';
  const cookieStore = await cookies();
  const viewAsCookie = cookieStore.get(VIEW_AS_COOKIE_NAME)?.value;
  const adminPreviewAsParent = isAdmin && viewAsCookie === 'parent';

  if (isAdmin && !adminPreviewAsParent) {
    redirect('/admin');
  }

  const nowISO = new Date().toISOString();
  const admin = createAdminClient(tenant.slug);

  if (userData?.role === 'parent' && checkoutAllowSavedAccountPercent()) {
    await ensureAutoFamilyDiscountForParent(admin, user.id, user.email);
  }

  const creditBalance = await getUserCreditBalance(user.id, tenant.slug);

  const youthWrestlerIds = await getParentYouthWrestlerIds(supabase, user.id);
  const { data: youthWrestlersRaw } = youthWrestlerIds.length > 0
    ? await supabase.from('youth_wrestlers').select('*').in('id', youthWrestlerIds).order('created_at', { ascending: false })
    : { data: [] };
  const youthWrestlers = [...new Map((youthWrestlersRaw ?? []).map((yw: YouthWrestler) => [yw.id, yw])).values()];
  const youthWrestlerIdSet = new Set(youthWrestlerIds);

  let familySessionIds: string[] = [];
  if (youthWrestlerIds.length > 0) {
    const { data: partRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('youth_wrestler_id', youthWrestlerIds);
    familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
  }

  const { data: upcomingSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id,
          scheduled_datetime,
          status,
          session_type,
          session_mode,
          duration_minutes,
          athletes:athlete_id(id, first_name, last_name),
          facilities:facility_id(id, name),
          session_participants(youth_wrestler_id, youth_wrestlers(first_name, last_name))
        `)
        .in('id', familySessionIds)
        .in('status', ['scheduled', 'pending_payment'])
        .gte('scheduled_datetime', nowISO)
        .order('scheduled_datetime', { ascending: true })
        .limit(100)
    : { data: [] };

  const { data: reviewIdRows } = await supabase
    .from('reviews')
    .select('session_id')
    .eq('parent_id', user.id);
  const reviewedSessionIds = new Set(
    (reviewIdRows ?? []).map((r: { session_id: string }) => r.session_id).filter(Boolean)
  );

  const { data: completedSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select(`
          id,
          athlete_id,
          scheduled_datetime,
          session_type,
          session_mode,
          athletes:athlete_id(first_name, last_name),
          session_participants(youth_wrestler_id, youth_wrestlers(id, first_name, last_name))
        `)
        .in('id', familySessionIds)
        .eq('status', 'completed')
        .order('scheduled_datetime', { ascending: false })
        .limit(200)
    : { data: [] };

  type CompletedRow = {
    id: string;
    athlete_id?: string | null;
    scheduled_datetime: string;
    session_type?: string | null;
    session_mode?: string | null;
    athletes?: { first_name?: string; last_name?: string } | null;
    session_participants?: Array<{
      youth_wrestler_id?: string | null;
      youth_wrestlers?: { id?: string; first_name?: string; last_name?: string } | { id?: string; first_name?: string; last_name?: string }[] | null;
    }>;
  };

  const reviewPayloads: ReviewSessionPayload[] = [];
  for (const raw of (completedSessions ?? []) as CompletedRow[]) {
    if (reviewedSessionIds.has(raw.id)) continue;
    const parts = raw.session_participants ?? [];
    const attendingAthletes: { id: string; first_name?: string; last_name?: string }[] = [];
    for (const p of parts) {
      const ywRaw = p.youth_wrestlers;
      const yw = Array.isArray(ywRaw) ? ywRaw[0] : ywRaw;
      const yid = p.youth_wrestler_id || yw?.id;
      if (!yid || !youthWrestlerIdSet.has(yid)) continue;
      attendingAthletes.push({
        id: yid,
        first_name: yw?.first_name,
        last_name: yw?.last_name,
      });
    }
    if (attendingAthletes.length === 0) continue;
    const coach = Array.isArray(raw.athletes) ? raw.athletes[0] : raw.athletes;
    reviewPayloads.push({
      id: raw.id,
      scheduled_datetime: raw.scheduled_datetime,
      session_type: raw.session_type,
      session_mode: raw.session_mode,
      athlete_id: raw.athlete_id ?? undefined,
      athletes: coach && !Array.isArray(coach) ? coach : null,
      attendingAthletes,
    });
  }

  const discoverySessions =
    (upcomingSessions ?? []).length === 0 ? await fetchDiscoverySessions(admin, user.id, nowISO) : [];

  type UpcomingRow = {
    id: string;
    scheduled_datetime: string;
    session_type?: string | null;
    session_mode?: string | null;
    duration_minutes?: number | null;
    athletes?: { first_name?: string; last_name?: string } | null;
    facilities?: { name?: string } | null;
    session_participants?: Array<{
      youth_wrestler_id?: string | null;
      youth_wrestlers?: { first_name?: string; last_name?: string } | null;
    }>;
  };

  const parentFirstName = (userData?.first_name ?? '').trim() || 'there';

  return (
    <div className="min-h-screen pb-24">
      {creditBalance > 0 && (
        <Link
          href="/wallet"
          className="block mx-4 mt-4 mb-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-black"
        >
          <p className="text-sm font-medium">
            💰 You have ${creditBalance.toFixed(2)} in Guild credit — applied automatically at checkout
          </p>
        </Link>
      )}

      <div className="px-4 pt-6 pb-2">
        <h1 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Home</h1>
        <p className="text-2xl font-bold text-foreground mt-1">
          Hey {parentFirstName} 👋
        </p>
      </div>

      <section className="px-4 mb-6" aria-label="Upcoming training">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Upcoming training
        </h2>
        {(upcomingSessions ?? []).length > 0 ? (
          <div className="space-y-3">
            {(upcomingSessions ?? []).map((session) => {
              const s = session as UpcomingRow;
              const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
              const facility = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
              const coachName = coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ').trim() : 'Coach';
              const typeLabel = getSessionTypeDisplay(s.session_type ?? null, s.session_mode ?? null).label;
              const dt = new Date(s.scheduled_datetime);
              const dur = s.duration_minutes;
              const kidNames: string[] = [];
              for (const p of s.session_participants ?? []) {
                if (!p.youth_wrestler_id || !youthWrestlerIdSet.has(p.youth_wrestler_id)) continue;
                const yw = p.youth_wrestlers;
                const nm = yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ').trim() : '';
                if (nm) kidNames.push(nm);
              }
              const kidsLine =
                kidNames.length === 0
                  ? ''
                  : kidNames.length === 1
                    ? `${kidNames[0]} registered`
                    : `${kidNames.join(', ')} registered`;

              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2"
                >
                  <p className="font-semibold text-foreground">
                    {formatEST(dt, 'EEE, MMM d')} · {formatEST(dt, 'h:mm a')}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {typeLabel}
                    {facility?.name ? ` · ${facility.name}` : ''}
                    {dur != null && dur > 0 ? ` · ${dur} min` : ''}
                  </p>
                  <p className="text-sm text-zinc-300">
                    {coachName}
                    {kidsLine ? ` · ${kidsLine}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-6 text-center">
            <p className="text-zinc-400 mb-4">No upcoming sessions</p>
            <Button className="w-full min-h-[48px] bg-[#D4AF37] hover:bg-[#c9a432] text-black font-semibold" asChild>
              <Link href="/training">Find Training</Link>
            </Button>
            <ParentHomeDiscoverySection sessions={discoverySessions} parentWrestlerIds={youthWrestlerIds} />
          </div>
        )}
      </section>

      <ParentHomeReviewsSection
        sessions={reviewPayloads}
        youthWrestlers={youthWrestlers.map((y) => ({
          id: y.id,
          first_name: y.first_name,
          last_name: y.last_name,
        }))}
      />

      <section className="px-4 pb-8">
        <Button
          className="w-full min-h-[52px] bg-[#D4AF37] hover:bg-[#c9a432] text-black font-semibold text-base"
          asChild
        >
          <Link href="/training">Find Training →</Link>
        </Button>
      </section>
    </div>
  );
}
