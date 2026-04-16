'use client';

import Link from 'next/link';
import { CoachLocatorMap } from '@/components/map/coach-locator-map';
import type { CoachMapPin, CoachMapStats } from '@/lib/map/fetch-coach-map-pins';

export function CoachMapShell({
  accessToken,
  initialPins,
  initialCities,
  initialStats,
  showFiltersBelowMap = false,
}: {
  accessToken: string;
  initialPins: CoachMapPin[];
  initialCities: string[];
  initialStats: CoachMapStats | null;
  showFiltersBelowMap?: boolean;
}) {
  if (!accessToken) {
    return <CoachListFallback pins={initialPins} />;
  }

  return (
    <CoachLocatorMap
      accessToken={accessToken}
      initialPins={initialPins}
      initialCities={initialCities}
      initialStats={initialStats}
      showFiltersBelowMap={showFiltersBelowMap}
    />
  );
}

function CoachListFallback({ pins }: { pins: CoachMapPin[] }) {
  const byCity = new Map<string, CoachMapPin[]>();
  for (const p of pins) {
    const city = p.facilityAddress?.split(',')[0]?.trim() || 'North Carolina';
    const list = byCity.get(city) ?? [];
    list.push(p);
    byCity.set(city, list);
  }
  const cities = Array.from(byCity.keys()).sort((a, b) => a.localeCompare(b));

  if (pins.length === 0) {
    return (
      <p className="text-center text-sm text-white/50">
        Coach locations will appear here once facilities have map coordinates.
      </p>
    );
  }

  return (
    <ul className="mx-auto max-w-lg space-y-4 text-left text-sm text-white/80">
      {cities.map((city) => (
        <li key={city}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent/80">{city}</p>
          <ul className="space-y-1">
            {byCity.get(city)?.map((p) => (
              <li key={p.pinKey}>
                <Link href={`/athlete/${p.coachId}`} className="text-accent hover:underline">
                  {p.firstName} {p.lastName}
                </Link>
                <span className="text-white/40"> · {p.facilityName}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
