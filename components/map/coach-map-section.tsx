import { fetchCoachMapPins } from '@/lib/map/fetch-coach-map-pins';
import { CoachMapShell } from '@/components/map/coach-map-shell';
import { PublicOpenJoinSessionsTable } from '@/components/map/public-open-join-sessions-table';
import { createClient } from '@/lib/supabase/server';

export async function CoachMapSection({
  tenantSlug,
  openSessionsRowFilter = 'all',
}: {
  tenantSlug: string;
  openSessionsRowFilter?: 'all' | 'partner' | 'small_group';
}) {
  const result = await fetchCoachMapPins(tenantSlug);
  const pins = result.ok ? result.pins : [];
  const cities = result.ok ? result.cities : [];
  const initialStats = result.ok ? result.stats : null;
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

  const supabase = await createClient(tenantSlug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  return (
    <section className="border-t border-accent/20 bg-black py-12 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-serif text-xl font-black uppercase tracking-wide text-accent md:text-2xl">
          Explore the map
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/60">
          Use the filters above the map, then tap a pin. Pan and zoom to see who&apos;s near you.
        </p>

        <div className="mt-8">
          <CoachMapShell
            accessToken={accessToken}
            initialPins={pins}
            initialCities={cities}
            initialStats={initialStats}
            showFiltersBelowMap={false}
          />
        </div>

        <PublicOpenJoinSessionsTable
          tenantSlug={tenantSlug}
          rowKindFilter={openSessionsRowFilter}
          isLoggedIn={isLoggedIn}
        />

        {!accessToken && (
          <p className="mt-4 text-center text-xs text-white/40">
            Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the interactive map.
          </p>
        )}
      </div>
    </section>
  );
}
