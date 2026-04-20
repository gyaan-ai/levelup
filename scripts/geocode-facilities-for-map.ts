/**
 * Geocode `facilities` missing latitude/longitude so coaches appear on the Coach Locator map.
 *
 * ## Why this exists (product vs data model)
 * The map does **not** use `users.zip_code`. Pins come only from:
 *   - `facilities.latitude` + `facilities.longitude` (both non-null), and
 *   - `athletes.facility_id` or `athletes.secondary_facility_id` pointing at that facility,
 *   - coach row included by `lib/map/fetch-coach-map-pins.ts` (active or pending application; not rejected/suspended).
 * Collecting ZIPs on accounts is useful for ops/comms; map placement still requires geocoded facilities.
 *
 * ## Going forward (operational)
 * 1. **New facility** (admin create / approved facility request): run this script (or paste lat/lng from
 *    Google/Mapbox manually in Supabase). Prefer a full street address in `address` for best geocode hits.
 * 2. **Coach onboarding**: confirm each coach’s primary (and optional secondary) facility is the row you
 *    geocoded — otherwise they still won’t pin.
 * 3. **After bulk imports**: `--dry-run` first, then run without it.
 * 4. **Optional hygiene**: re-run `--dry-run` periodically; it lists rows still missing coords.
 *
 * ## Requirements
 * - `.env.local` (or env) with Supabase URL + service role key (same as other admin scripts).
 * - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (or `MAPBOX_ACCESS_TOKEN`) — Mapbox *forward* geocoding.
 *
 * ## Run
 *   npx tsx scripts/geocode-facilities-for-map.ts --dry-run
 *   npx tsx scripts/geocode-facilities-for-map.ts
 *   npx tsx scripts/geocode-facilities-for-map.ts --facility-id=<uuid>
 *
 * Node 20+: you can load env with `node --env-file=.env.local` if you wrap the command.
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvLocal() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  const raw = readFileSync(p, 'utf8');
  for (let line of raw.split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnvLocal();

type FacilityRow = {
  id: string;
  name: string;
  school: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  let facilityId: string | null = null;
  for (const a of process.argv) {
    if (a.startsWith('--facility-id=')) {
      facilityId = a.slice('--facility-id='.length).trim() || null;
    }
  }
  return { dryRun, facilityId };
}

function supabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GUILD_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_URL ||
    ''
  );
}

function serviceRoleKey(): string {
  return (
    process.env.GUILD_SUPABASE_SERVICE_KEY ||
    process.env.NC_UNITED_SUPABASE_SERVICE_KEY ||
    ''
  );
}

function mapboxToken(): string {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    ''
  );
}

function buildGeocodeQuery(f: FacilityRow): string {
  const addr = (f.address ?? '').trim();
  if (addr.length >= 5) return addr;
  const name = (f.name ?? '').trim();
  const school = (f.school ?? '').trim();
  if (name && school) return `${name}, ${school}, NC, USA`;
  if (name) return `${name}, NC, USA`;
  if (school) return `${school}, NC, USA`;
  return '';
}

type MapboxFeature = {
  center?: [number, number];
  place_name?: string;
};

async function geocodeMapbox(query: string, token: string): Promise<{ lng: number; lat: number; label: string } | null> {
  const q = encodeURIComponent(query);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${encodeURIComponent(token)}&limit=1&country=us`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Mapbox HTTP ${res.status} for query: ${query.slice(0, 80)}…`);
    return null;
  }
  const data = (await res.json()) as { features?: MapboxFeature[] };
  const f = data.features?.[0];
  const c = f?.center;
  if (!c || c.length < 2) return null;
  const [lng, lat] = c;
  return { lng, lat, label: f?.place_name ?? query };
}

async function main() {
  const { dryRun, facilityId } = parseArgs();
  const url = supabaseUrl();
  const key = serviceRoleKey();
  const token = mapboxToken();

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_GUILD_SUPABASE_URL (or NC_UNITED) and GUILD_SUPABASE_SERVICE_KEY (or NC_UNITED).');
    process.exit(1);
  }
  if (!token) {
    console.error('Missing NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or MAPBOX_ACCESS_TOKEN).');
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let q = admin
    .from('facilities')
    .select('id, name, school, address, latitude, longitude')
    .or('latitude.is.null,longitude.is.null');

  if (facilityId) {
    q = admin.from('facilities').select('id, name, school, address, latitude, longitude').eq('id', facilityId);
  }

  const { data: rows, error } = await q.order('school', { ascending: true }).order('name', { ascending: true });

  if (error) {
    console.error('Supabase facilities query:', error.message);
    process.exit(1);
  }

  const list = (rows ?? []) as FacilityRow[];
  if (list.length === 0) {
    console.log('No facilities need geocoding (missing lat or lng). Map pins should include every coach linked to a facility row with coords.');
    process.exit(0);
  }

  console.log(`${dryRun ? '[dry-run] Would geocode' : 'Geocoding'} ${list.length} facility row(s)…\n`);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const f of list) {
    if (f.latitude != null && f.longitude != null && !facilityId) {
      skip++;
      continue;
    }
    const query = buildGeocodeQuery(f);
    if (!query) {
      console.warn(`— Skip ${f.id}: no address/name/school to search`);
      fail++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${f.name} (${f.school ?? '—'})\n    query: ${query}`);
      continue;
    }

    const geo = await geocodeMapbox(query, token);
    if (!geo) {
      console.warn(`— No result: ${f.name} | query: ${query}`);
      fail++;
      continue;
    }

    const { error: upErr } = await admin
      .from('facilities')
      .update({
        latitude: geo.lat,
        longitude: geo.lng,
      })
      .eq('id', f.id);

    if (upErr) {
      console.error(`— Update failed ${f.id}:`, upErr.message);
      fail++;
      continue;
    }

    ok++;
    console.log(`✓ ${f.name} → ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} (${geo.label})`);

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(
    `\nDone. ${dryRun ? 'Dry-run only.' : `Updated: ${ok}, skipped: ${skip}, failed: ${fail}.`} Verify coaches use facility_id / secondary_facility_id for these rows.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
