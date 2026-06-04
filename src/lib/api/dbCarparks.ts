/**
 * Read-only fetch against the Supabase carparks + rate_rows tables.
 *
 * Hits PostgREST directly (no @supabase/supabase-js — saves ~150 KB
 * gzipped from the client bundle). Uses a coarse lat/lng bounding
 * box, then haversine refines client-side. Returns carparks with
 * their rate_rows[] embedded via the standard PostgREST relation
 * syntax.
 *
 * The anon key is fine to ship to the client — Supabase RLS keeps
 * writes service-role only.
 */

import { haversineMeters } from '../geo';

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (typeof window !== 'undefined' && (!URL_BASE || !ANON_KEY)) {
  // eslint-disable-next-line no-console
  console.warn(
    '[dbCarparks] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing — runtime DB reads disabled',
  );
}

// ── DB row shapes (camel-cased on the client, snake on the wire) ──────

export type DbAgency = 'HDB' | 'URA' | 'LTA' | 'JTC' | 'NPARKS' | 'OPERATOR';
export type DbParkingSystem = 'EPS' | 'COUPON' | 'GANTRY_PRIVATE' | 'FLAT';
export type DbDayType = 'WEEKDAY' | 'SAT' | 'SUN_PH';
export type DbVehCat = 'CAR' | 'MOTORCYCLE' | 'HEAVY';
export type DbSource =
  | 'URA'
  | 'HDB'
  | 'LTA_DATAGOV'
  | 'LTA_DATAMALL'
  | 'CAG'
  | 'OPERATOR'
  | 'MANUAL';

export type DbRateRowRaw = {
  day_type: DbDayType;
  start_time: string | null;
  end_time: string | null;
  per_block_cents: number;
  block_minutes: number;
  first_hour_cents: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: DbParkingSystem;
  veh_cat: DbVehCat;
  source: DbSource;
  effective_from: string | null;
};

export type DbCarparkRaw = {
  id: string;
  agency: DbAgency;
  source_code: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  car_park_type: string | null;
  parking_system: DbParkingSystem;
  central_area: boolean;
  total_lots: number | null;
  source: DbSource;
  rate_rows: DbRateRowRaw[];
};

// ── Distance math ─────────────────────────────────────────────────────

/** Degrees of latitude per metre. Spherical approximation — fine for SG. */
const DEG_LAT_PER_M = 1 / 111_000;

function boundingBox(
  centre: { lat: number; lng: number },
  radiusM: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusM * DEG_LAT_PER_M;
  const lngDelta =
    radiusM * DEG_LAT_PER_M / Math.cos((centre.lat * Math.PI) / 180);
  return {
    minLat: centre.lat - latDelta,
    maxLat: centre.lat + latDelta,
    minLng: centre.lng - lngDelta,
    maxLng: centre.lng + lngDelta,
  };
}

// ── Fetcher ────────────────────────────────────────────────────────────

const CARPARK_SELECT =
  'id,agency,source_code,name,address,lat,lng,car_park_type,parking_system,central_area,total_lots,source,rate_rows(day_type,start_time,end_time,per_block_cents,block_minutes,first_hour_cents,per_entry_cents,cap_cents,grace_minutes,system,veh_cat,source,effective_from)';

/**
 * Fetch a single carpark (with rate_rows) by its URL slug — used when the app
 * cold-loads on a `/carpark/:slug` SEO URL and boots straight to that carpark's
 * Detail screen. Mirrors `fetchCarparkById` but matches the stable `slug`
 * column the SSR pages link by.
 */
export async function fetchCarparkBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<DbCarparkRaw | null> {
  if (!URL_BASE || !ANON_KEY) return null;

  const params = new URLSearchParams({
    select: CARPARK_SELECT,
    slug: `eq.${slug.toLowerCase()}`,
    limit: '1',
  });

  const res = await fetch(`${URL_BASE}/rest/v1/carparks?${params.toString()}`, {
    signal,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as DbCarparkRaw[];
  const row = rows[0];
  if (!row || row.lat == null || row.lng == null) return null;
  return row;
}

/**
 * Returns every carpark within `radiusM` of `centre`, with its rate_rows
 * embedded. Result is unsorted; caller ranks (by distance or cost).
 */
export async function fetchNearbyCarparks(
  centre: { lat: number; lng: number },
  radiusM: number,
  signal?: AbortSignal,
): Promise<DbCarparkRaw[]> {
  if (!URL_BASE || !ANON_KEY) return [];

  const bb = boundingBox(centre, radiusM);
  // PostgREST query — embed rate_rows via the FK relation, filter on the
  // bounding box. We over-fetch slightly (box vs circle), then refine
  // by haversine below.
  const params = new URLSearchParams({
    select: CARPARK_SELECT,
    'lat': `gte.${bb.minLat}`,
    'lng': `gte.${bb.minLng}`,
  });
  // URLSearchParams collapses duplicate keys to one; use append for the upper bounds.
  params.append('lat', `lte.${bb.maxLat}`);
  params.append('lng', `lte.${bb.maxLng}`);

  const res = await fetch(`${URL_BASE}/rest/v1/carparks?${params.toString()}`, {
    signal,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase carparks ${res.status}: ${detail.slice(0, 200)}`);
  }
  const rows = (await res.json()) as DbCarparkRaw[];

  // Haversine refine — drop carparks outside the true radius and any with
  // null coords (LTA-CSV-only entries that have no spatial location).
  return rows.filter((r) => {
    if (r.lat == null || r.lng == null) return false;
    const d = haversineMeters(centre, { lat: r.lat, lng: r.lng });
    return d <= radiusM;
  });
}

/**
 * Fetch a single carpark (with rate_rows) by its id, e.g. opening a saved
 * carpark straight to its Detail screen without a surrounding search.
 *
 * Saved ids are lower-cased app ids (`hdb:u57`) while the DB stores the
 * original case (`HDB:U57`), so we match case-insensitively. Wildcard
 * characters in the id are escaped so `ilike` behaves as an exact match.
 */
export async function fetchCarparkById(
  id: string,
  signal?: AbortSignal,
): Promise<DbCarparkRaw | null> {
  if (!URL_BASE || !ANON_KEY) return null;

  const escaped = id.replace(/[\\%_]/g, '\\$&');
  const params = new URLSearchParams({
    select: CARPARK_SELECT,
    id: `ilike.${escaped}`,
    limit: '1',
  });

  const res = await fetch(`${URL_BASE}/rest/v1/carparks?${params.toString()}`, {
    signal,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as DbCarparkRaw[];
  const row = rows[0];
  if (!row || row.lat == null || row.lng == null) return null;
  return row;
}
