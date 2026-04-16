import { fetchCoachMapPins } from '@/lib/map/fetch-coach-map-pins';
import { CoachMapShell } from '@/components/map/coach-map-shell';

export async function CoachMapSection({ tenantSlug }: { tenantSlug: string }) {
  const result = await fetchCoachMapPins(tenantSlug);
  const pins = result.ok ? result.pins : [];
  const cities = result.ok ? result.cities : [];
  const initialStats = result.ok ? result.stats : null;
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

  return (
    <section className="border-t border-accent/20 bg-black py-12 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-serif text-2xl font-black uppercase tracking-wide text-accent md:text-3xl">
          Find Elite Coaching Near You
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-white/60">
          Guild coaches are training wrestlers across North Carolina
        </p>

        <div className="mt-8">
          <CoachMapShell
            accessToken={accessToken}
            initialPins={pins}
            initialCities={cities}
            initialStats={initialStats}
            showFiltersBelowMap
          />
        </div>

        {!accessToken && (
          <p className="mt-4 text-center text-xs text-white/40">
            Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the interactive map.
          </p>
        )}
      </div>
    </section>
  );
}
