'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProfileImage } from '@/components/profile-image';
import { SchoolLogo } from '@/components/school-logo';
import { StarRating } from '@/components/star-rating';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { formatEST } from '@/lib/format-date';
import { NC_BOUNDS_LNG_LAT, NC_MAX_BOUNDS_LNG_LAT, GUILD_GOLD } from '@/lib/map/nc-bounds';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, X } from 'lucide-react';
import type { CoachMapPin, CoachMapStats, SessionKind } from '@/lib/map/fetch-coach-map-pins';

export type { CoachMapPin };

function CoachMapEmptyHint({ stats }: { stats: CoachMapStats }) {
  let body: string;
  if (stats.facilitiesWithCoordinates === 0) {
    body =
      'No facilities have map coordinates yet. In Supabase, set latitude and longitude on each row in facilities (WGS84). Pins only appear after both values are filled.';
  } else if (stats.coachesLinkedToGeocodedFacilities === 0) {
    body =
      'No active coaches are linked to a geocoded facility. In Supabase, set athletes.facility_id or secondary_facility_id to a facility that has latitude and longitude.';
  } else {
    body = 'Coach pins could not be built. Check server logs or contact support.';
  }
  return (
    <div className="mt-3 rounded-lg border border-accent/25 bg-black/50 px-3 py-2.5 text-left text-xs leading-relaxed text-white/75">
      <p className="font-semibold text-accent/90">Why there are no pins yet</p>
      <p className="mt-1 text-white/65">{body}</p>
    </div>
  );
}

const WEIGHT_OPTIONS = [
  'all',
  '125',
  '133',
  '141',
  '149',
  '157',
  '165',
  '174',
  '184',
  '197',
  '285',
] as const;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function weightMatches(coachWeight: string | null, filterLb: string): boolean {
  if (filterLb === 'all') return true;
  if (!coachWeight) return false;
  const digits = coachWeight.match(/\d+/)?.[0];
  return digits === filterLb || coachWeight.includes(filterLb);
}

function sessionTypeMatches(kinds: SessionKind[], filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'private') return kinds.includes('private');
  if (filter === 'partner') return kinds.includes('partner');
  if (filter === 'small_group') return kinds.includes('small_group');
  return true;
}

function searchMatches(pin: CoachMapPin, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [pin.facilityName, pin.facilityAddress ?? '', pin.facilityAddress?.split(',')[0] ?? '']
    .join(' ')
    .toLowerCase();
  return hay.includes(s) || (/\d{5}/.test(s) && hay.includes(s));
}

export function CoachLocatorMap({
  accessToken,
  className,
  mapHeightClass = 'h-[350px] md:h-[500px]',
  showFiltersBelowMap = false,
  initialPins,
  initialCities,
  initialStats,
}: {
  accessToken: string;
  className?: string;
  mapHeightClass?: string;
  showFiltersBelowMap?: boolean;
  initialPins?: CoachMapPin[];
  initialCities?: string[];
  initialStats?: CoachMapStats | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pinsRef = useRef<CoachMapPin[]>([]);

  const [pins, setPins] = useState<CoachMapPin[]>(initialPins ?? []);
  const [cities, setCities] = useState<string[]>(initialCities ?? []);
  const [stats, setStats] = useState<CoachMapStats | null>(initialStats ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState('all');
  const [weightClass, setWeightClass] = useState('all');
  /** Narrow to coaches with a bookable path: open seat on a public join-in session and/or published calendar availability. */
  const [takingBookingsOnly, setTakingBookingsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  /** One or more pins (cluster at same spot opens many). */
  const [selectedPins, setSelectedPins] = useState<CoachMapPin[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (initialPins && initialPins.length > 0) return;
    let cancelled = false;
    fetch('/api/map/coach-pins')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        setPins(data.pins ?? []);
        setCities(data.cities ?? []);
        if (data.stats) setStats(data.stats);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load coaches');
      });
    return () => {
      cancelled = true;
    };
  }, [initialPins]);

  const filteredPins = useMemo(() => {
    let list = pins.filter((p) => {
      if (!sessionTypeMatches(p.sessionKinds, sessionType)) return false;
      if (!weightMatches(p.weightClass, weightClass)) return false;
      if (
        takingBookingsOnly &&
        !p.hasOpenSession &&
        !p.hasPublishedAvailability
      ) {
        return false;
      }
      if (!searchMatches(p, search)) return false;
      return true;
    });
    if (userPos) {
      list = [...list].sort(
        (a, b) =>
          haversineMiles(userPos.lat, userPos.lng, a.latitude, a.longitude) -
          haversineMiles(userPos.lat, userPos.lng, b.latitude, b.longitude)
      );
    }
    return list;
  }, [pins, sessionType, weightClass, takingBookingsOnly, search, userPos]);

  pinsRef.current = filteredPins;

  const geoJson = useMemo(() => {
    const staggerMs = 40;
    return {
      type: 'FeatureCollection' as const,
      features: filteredPins.map((p, i) => ({
        type: 'Feature' as const,
        id: p.pinKey,
        properties: {
          pinKey: p.pinKey,
          coachId: p.coachId,
          stagger: i * staggerMs,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.longitude, p.latitude],
        },
      })),
    };
  }, [filteredPins]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoDenied(false);
      },
      () => setGeoDenied(true),
      { enableHighAccuracy: true, timeout: 12_000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (!containerRef.current || !accessToken || !visible) return;
    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      bounds: NC_BOUNDS_LNG_LAT,
      fitBoundsOptions: { padding: 48, duration: 0 },
      maxBounds: NC_MAX_BOUNDS_LNG_LAT,
      minZoom: 5.2,
      maxZoom: 14,
      attributionControl: true,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('nc-boundary', {
        type: 'geojson',
        data: '/geo/nc-state.geojson',
      });
      map.addLayer({
        id: 'nc-outline',
        type: 'line',
        source: 'nc-boundary',
        paint: {
          'line-color': GUILD_GOLD,
          'line-width': 2,
          'line-opacity': 0.85,
        },
      });

      try {
        map.addLayer({
          id: 'dim-non-nc',
          type: 'fill',
          source: 'composite',
          'source-layer': 'admin',
          filter: ['!=', ['get', 'name'], 'North Carolina'],
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.45,
          },
        });
      } catch {
        /* composite admin layer may be unavailable for this style */
      }

      map.addSource('coaches', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 52,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'coaches',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': GUILD_GOLD,
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 26, 28],
          'circle-opacity': 0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#1a1a1a',
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'coaches',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#111',
        },
      });

      map.addLayer({
        id: 'unclustered',
        type: 'circle',
        source: 'coaches',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': GUILD_GOLD,
          'circle-radius': 11,
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#1a1a1a',
        },
      });

      const onClusterClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id as number | undefined;
        if (clusterId == null) return;
        const src = map.getSource('coaches') as mapboxgl.GeoJSONSource;
        src.getClusterLeaves(clusterId, 64, 0, (err, leaves) => {
          if (err || !leaves?.length) {
            src.getClusterExpansionZoom(clusterId, (zErr, zoom) => {
              if (zErr || zoom == null) return;
              const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
              map.easeTo({ center: coords, zoom });
            });
            return;
          }
          const keys = leaves
            .map((leaf) => (leaf.properties as { pinKey?: string })?.pinKey)
            .filter((k): k is string => typeof k === 'string' && k.length > 0);
          const list = keys
            .map((k) => pinsRef.current.find((p) => p.pinKey === k))
            .filter((p): p is CoachMapPin => p != null);
          if (list.length === 0) return;
          setSelectedPins(list);
        });
      };

      const onPinClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        const key = f?.properties?.pinKey as string | undefined;
        if (!key) return;
        const pin = pinsRef.current.find((p) => p.pinKey === key);
        if (pin) setSelectedPins([pin]);
      };

      map.on('click', 'clusters', onClusterClick);
      map.on('click', 'unclustered', onPinClick);
      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'unclustered', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });

    return () => {
      setMapReady(false);
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, visible]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map?.getSource('coaches')) return;
    const src = map.getSource('coaches') as mapboxgl.GeoJSONSource;
    src.setData(geoJson);
  }, [geoJson, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    userMarkerRef.current?.remove();
    const el = document.createElement('div');
    el.className =
      'h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-md ring-2 ring-sky-400/50';
    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([userPos.lng, userPos.lat])
      .addTo(map);
  }, [userPos]);

  const distanceMiles = useCallback(
    (pin: CoachMapPin) => {
      if (!userPos) return null;
      return haversineMiles(userPos.lat, userPos.lng, pin.latitude, pin.longitude);
    },
    [userPos]
  );

  const filterBar = (
    <div
      className={cn(
        'flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:pb-0 [&::-webkit-scrollbar]:hidden',
        showFiltersBelowMap ? 'mt-4' : 'mb-4'
      )}
    >
      <select
        aria-label="Session format on public join-in sessions (optional filter)"
        value={sessionType}
        onChange={(e) => setSessionType(e.target.value)}
        className="shrink-0 rounded-full border border-white/15 bg-black/80 px-3 py-2 text-xs text-white"
      >
        <option value="all">All formats (public calendar)</option>
        <option value="private">Private</option>
        <option value="partner">Partner</option>
        <option value="small_group">Small group</option>
      </select>
      <select
        aria-label="Weight class"
        value={weightClass}
        onChange={(e) => setWeightClass(e.target.value)}
        className="shrink-0 rounded-full border border-white/15 bg-black/80 px-3 py-2 text-xs text-white"
      >
        {WEIGHT_OPTIONS.map((w) => (
          <option key={w} value={w}>
            {w === 'all' ? 'All weights' : `${w} lbs`}
          </option>
        ))}
      </select>
      <label
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-2 text-xs text-white"
        title="Coaches with an open seat on a public join-in session and/or published calendar availability. Leave off to see the full network."
      >
        <input
          type="checkbox"
          checked={takingBookingsOnly}
          onChange={(e) => setTakingBookingsOnly(e.target.checked)}
          className="rounded border-white/30"
        />
        Taking bookings
      </label>
      <input
        type="search"
        placeholder="City or zip"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="min-w-[140px] shrink-0 rounded-full border border-white/15 bg-black/80 px-3 py-2 text-xs text-white placeholder:text-white/40"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 rounded-full border-accent/50 text-accent"
        onClick={requestLocation}
      >
        <Navigation className="mr-1 h-3.5 w-3.5" />
        Near me
      </Button>
    </div>
  );

  const coachCount = new Set(filteredPins.map((p) => p.coachId)).size;
  const cityCount = cities.length;

  return (
    <div ref={sectionRef} className={cn('w-full', className)}>
      {!showFiltersBelowMap && filterBar}

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-lg border border-accent/25 bg-black/40 shadow-[0_0_40px_rgba(201,168,76,0.08)] transition-opacity duration-500',
          visible ? 'opacity-100' : 'opacity-0',
          mapHeightClass
        )}
      >
        {loadError && (
          <p className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 px-4 text-center text-sm text-white/70">
            {loadError}
          </p>
        )}
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      </div>

      {showFiltersBelowMap && filterBar}

      {pins.length === 0 && stats && !loadError && <CoachMapEmptyHint stats={stats} />}

      <p className="mt-3 text-center text-xs text-white/50">
        Training is scheduled with Guild coaches when you book or request a time—public join-in sessions on the
        calendar are optional, not the only way to train.
      </p>
      <p className="mt-1.5 text-center text-xs text-white/45">
        {coachCount} coach{coachCount === 1 ? '' : 'es'} across{' '}
        {cityCount > 0 ? cityCount : pins.length === 0 ? '0' : 'several'} cities in North Carolina
        {geoDenied && !userPos && ' · Location off — distances hidden'}
      </p>

      {selectedPins && selectedPins.length > 0 && (
        <>
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              aria-label="Close"
              onClick={() => setSelectedPins(null)}
            />
            <div className="animate-in slide-in-from-bottom duration-200 absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-2xl border border-accent/30 bg-zinc-950 shadow-2xl">
              {selectedPins.length > 1 ? (
                <>
                  <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 pb-3 pt-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        {selectedPins.length} coaches here
                      </p>
                      <p className="text-xs text-white/55">{selectedPins[0].facilityName}</p>
                      {selectedPins[0].facilityAddress && (
                        <p className="mt-0.5 text-xs text-white/40">{selectedPins[0].facilityAddress}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPins(null)}
                      className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div className="space-y-0">
                      {selectedPins.map((pin, i) => (
                        <div
                          key={pin.pinKey}
                          className={cn(i > 0 && 'mt-6 border-t border-white/10 pt-6')}
                        >
                          <CoachCardContent
                            pin={pin}
                            distanceMiles={distanceMiles(pin)}
                            onClose={() => setSelectedPins(null)}
                            showFacilityLine={false}
                            showCloseButton={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="overflow-y-auto p-4">
                  <CoachCardContent
                    pin={selectedPins[0]}
                    distanceMiles={distanceMiles(selectedPins[0])}
                    onClose={() => setSelectedPins(null)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 hidden w-full max-w-md -translate-x-1/2 md:block">
            <div className="pointer-events-auto mx-4 max-h-[min(80vh,640px)] overflow-y-auto rounded-xl border border-accent/30 bg-zinc-950 p-4 shadow-2xl">
              {selectedPins.length > 1 ? (
                <>
                  <div className="mb-4 flex items-start justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{selectedPins.length} coaches here</p>
                      <p className="text-xs text-white/55">{selectedPins[0].facilityName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPins(null)}
                      className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-0">
                    {selectedPins.map((pin, i) => (
                      <div
                        key={pin.pinKey}
                        className={cn(i > 0 && 'mt-6 border-t border-white/10 pt-6')}
                      >
                        <CoachCardContent
                          pin={pin}
                          distanceMiles={distanceMiles(pin)}
                          onClose={() => setSelectedPins(null)}
                          showFacilityLine={false}
                          showCloseButton={false}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <CoachCardContent
                  pin={selectedPins[0]}
                  distanceMiles={distanceMiles(selectedPins[0])}
                  onClose={() => setSelectedPins(null)}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CoachCardContent({
  pin,
  distanceMiles,
  onClose,
  showFacilityLine = true,
  showCloseButton = true,
}: {
  pin: CoachMapPin;
  distanceMiles: number | null;
  onClose: () => void;
  /** When listing several coaches at one facility, hide repeated address rows. */
  showFacilityLine?: boolean;
  showCloseButton?: boolean;
}) {
  const findTrainingHref = `/find-training?coach=${encodeURIComponent(pin.coachId)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <ProfileImage
            src={pin.photoUrl}
            alt={`${pin.firstName} ${pin.lastName}`}
            className="h-14 w-14 shrink-0 border-2 border-accent/40"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {pin.firstName} {pin.lastName}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <SchoolLogo school={pin.school} size="sm" />
              <span className="truncate text-xs text-white/70">{pin.school}</span>
            </div>
            {(pin.year || pin.weightClass) && (
              <p className="text-xs text-white/50">
                {[pin.year, pin.weightClass].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <StarRating averageRating={pin.averageRating} reviewCount={pin.reviewCount} size="sm" />

      <div className="flex flex-wrap gap-1.5">
        {pin.sessionKinds.length === 0 ? (
          <span className="text-xs text-white/40">Formats vary — schedule when you book</span>
        ) : (
          pin.sessionKinds.map((k) => (
            <SessionTypeBadge
              key={k}
              sessionType={k === 'private' ? 'private' : k === 'partner' ? 'partner' : 'group'}
            />
          ))
        )}
      </div>

      {pin.hasPublishedAvailability && (
        <p className="text-xs text-emerald-400/90">
          Publishes availability — pick a time when you book or request.
        </p>
      )}

      {pin.nextSessionAt && (
        <p className="text-xs text-white/70">
          Next public join-in: {formatEST(pin.nextSessionAt, 'MMM d · h:mm a')}
        </p>
      )}

      {showFacilityLine && (
        <p className="flex items-start gap-2 text-xs text-white/60">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/80" />
          <span>
            {pin.facilityName}
            {pin.facilityAddress ? ` · ${pin.facilityAddress}` : ''}
          </span>
        </p>
      )}

      {distanceMiles != null && (
        <p className="text-xs text-accent">{Math.round(distanceMiles * 10) / 10} miles away</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="premium" size="sm" className="w-full">
            <Link href={`/book/${pin.coachId}`}>Schedule a session</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="w-full border-accent/40 text-accent">
            <Link href={findTrainingHref}>Join a public session</Link>
          </Button>
        </div>
        <p className="text-center text-[11px] leading-snug text-white/45">
          Join a public session only if a posted group or partner slot works for you—most families use Schedule first.
        </p>
        <p className="text-center">
          <Link
            href={`/athlete/${pin.coachId}`}
            className="text-xs text-white/55 underline-offset-2 hover:text-white/85 hover:underline"
          >
            View profile
          </Link>
        </p>
      </div>
    </div>
  );
}
