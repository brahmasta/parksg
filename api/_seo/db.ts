/**
 * Server-side (Vercel Edge) reads against Supabase PostgREST for the SEO
 * landing pages. This mirrors the query shape of src/lib/api/dbCarparks.ts,
 * but reads credentials from `process.env` (the Edge runtime has no
 * `import.meta.env`) and returns a flatter, render-ready shape.
 *
 * Read-only, anon key — RLS keeps writes service-role only.
 */

import type { DayType, RateRow } from '../../src/lib/types';
import { haversineMeters } from '../../src/lib/geo';

const URL_BASE =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const CARPARK_SELECT =
  'id,slug,agency,source_code,name,address,lat,lng,car_park_type,parking_system,central_area,total_lots,source,rate_rows(day_type,start_time,end_time,per_block_cents,block_minutes,first_hour_cents,per_entry_cents,cap_cents,grace_minutes,system,veh_cat,source,effective_from)';

type DbRateRowRaw = {
  day_type: DayType;
  start_time: string | null;
  end_time: string | null;
  per_block_cents: number | null;
  block_minutes: number | null;
  first_hour_cents: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: RateRow['system'];
  veh_cat: 'CAR' | 'MOTORCYCLE' | 'HEAVY';
  source: RateRow['source'];
  effective_from: string | null;
};

type DbCarparkRaw = {
  id: string;
  slug: string;
  agency: string;
  source_code: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  car_park_type: string | null;
  parking_system: string;
  central_area: boolean;
  total_lots: number | null;
  source: string;
  rate_rows: DbRateRowRaw[];
};

/** Render-ready carpark — grouped rates + the fields the SEO page needs. */
export type SeoCarpark = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  operator: string;
  lat: number;
  lng: number;
  totalLots: number | null;
  parkingSystem: string;
  rates: {
    weekday: RateRow[];
    saturday: RateRow[];
    sundayPH: RateRow[];
  };
};

const DEG_LAT_PER_M = 1 / 111_000;

function authHeaders(): HeadersInit {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    Accept: 'application/json',
  };
}

function toRateRow(r: DbRateRowRaw): RateRow {
  return {
    dayType: r.day_type,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
    firstHourCents: r.first_hour_cents ?? undefined,
    perBlockCents: r.per_block_cents ?? undefined,
    blockMinutes: r.block_minutes ?? undefined,
    perEntryCents: r.per_entry_cents ?? undefined,
    capCents: r.cap_cents ?? undefined,
    graceMinutes: r.grace_minutes ?? undefined,
    system: r.system,
    vehCat: r.veh_cat,
    source: r.source,
    effectiveFrom: r.effective_from ?? undefined,
  };
}

/** Group raw rate rows into the weekday/saturday/sundayPH buckets, CAR only. */
function groupRates(rows: DbRateRowRaw[]): SeoCarpark['rates'] {
  const out: SeoCarpark['rates'] = { weekday: [], saturday: [], sundayPH: [] };
  for (const raw of rows) {
    if (raw.veh_cat !== 'CAR') continue;
    const row = toRateRow(raw);
    if (raw.day_type === 'WEEKDAY') out.weekday.push(row);
    else if (raw.day_type === 'SAT') out.saturday.push(row);
    else if (raw.day_type === 'SUN_PH') out.sundayPH.push(row);
  }
  return out;
}

function toSeoCarpark(row: DbCarparkRaw): SeoCarpark | null {
  if (row.lat == null || row.lng == null) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    operator: row.agency,
    lat: row.lat,
    lng: row.lng,
    totalLots: row.total_lots,
    parkingSystem: row.parking_system,
    rates: groupRates(row.rate_rows ?? []),
  };
}

export function hasDbConfig(): boolean {
  return Boolean(URL_BASE && ANON_KEY);
}

/** One carpark (with rate rows) by its URL slug. */
export async function fetchCarparkBySlug(
  slug: string,
): Promise<SeoCarpark | null> {
  if (!hasDbConfig()) return null;
  const params = new URLSearchParams({
    select: CARPARK_SELECT,
    slug: `eq.${slug.toLowerCase()}`,
    limit: '1',
  });
  const res = await fetch(`${URL_BASE}/rest/v1/carparks?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as DbCarparkRaw[];
  const row = rows[0];
  return row ? toSeoCarpark(row) : null;
}

/** Carparks within `radiusM` of a centre (bounding box + haversine refine). */
export async function fetchCarparksInBox(
  centre: { lat: number; lng: number },
  radiusM: number,
): Promise<SeoCarpark[]> {
  if (!hasDbConfig()) return [];
  const latDelta = radiusM * DEG_LAT_PER_M;
  const lngDelta =
    (radiusM * DEG_LAT_PER_M) / Math.cos((centre.lat * Math.PI) / 180);
  const params = new URLSearchParams({ select: CARPARK_SELECT });
  params.append('lat', `gte.${centre.lat - latDelta}`);
  params.append('lat', `lte.${centre.lat + latDelta}`);
  params.append('lng', `gte.${centre.lng - lngDelta}`);
  params.append('lng', `lte.${centre.lng + lngDelta}`);
  params.append('limit', '200');
  const res = await fetch(`${URL_BASE}/rest/v1/carparks?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as DbCarparkRaw[];
  return rows
    .map(toSeoCarpark)
    .filter((c): c is SeoCarpark => c != null)
    .filter((c) => haversineMeters(centre, { lat: c.lat, lng: c.lng }) <= radiusM);
}

/** All carpark slugs that have coordinates — for the sitemap. Paginated to
 *  clear PostgREST's default 1000-row ceiling. */
export async function fetchAllCarparkSlugs(): Promise<string[]> {
  if (!hasDbConfig()) return [];
  const PAGE = 1000;
  const out: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      select: 'slug',
      lat: 'not.is.null',
      lng: 'not.is.null',
      order: 'slug.asc',
      limit: String(PAGE),
      offset: String(offset),
    });
    const res = await fetch(`${URL_BASE}/rest/v1/carparks?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) break;
    const rows = (await res.json()) as { slug: string }[];
    for (const r of rows) if (r.slug) out.push(r.slug);
    if (rows.length < PAGE) break;
    if (offset > 20_000) break; // safety cap
  }
  return out;
}
