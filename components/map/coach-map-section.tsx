import { fetchCoachMapPins } from '@/lib/map/fetch-coach-map-pins';
import { CoachMapShell } from '@/components/map/coach-map-shell';
import { PublicOpenJoinSessionsTable } from '@/components/map/public-open-join-sessions-table';

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
        <div className="mx-auto mt-4 max-w-2xl space-y-3 text-left text-sm text-white/65 sm:text-center">
          <p>
            <span className="font-semibold text-accent/90">1.</span> Find a coach on the map, then{' '}
            <span className="text-white/85">book a private or partner session</span>
            —if you choose partner, you&apos;ll invite your partner in the flow.
          </p>
          <p>
            <span className="font-semibold text-accent/90">2.</span>{' '}
            <span className="text-white/85">Browse open partner sessions and small groups</span> in the table below (or
            after you log in from a coach pin). These are optional join-ins, not the only way to train.
          </p>
        </div>
        <p className="mx-auto mt-3 max-w-xl text-center text-xs text-white/45">
          Filters sit above the map so you can narrow first, then explore—use city or zip to judge distance yourself.
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

        <PublicOpenJoinSessionsTable tenantSlug={tenantSlug} />

        {!accessToken && (
          <p className="mt-4 text-center text-xs text-white/40">
            Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the interactive map.
          </p>
        )}
      </div>
    </section>
  );
}
