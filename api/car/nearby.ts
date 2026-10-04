/**
 * GET /api/car/nearby?lat=&lng=&hours=2&limit=12[&label=]
 *
 * Carparks around a point for the Android Auto screens
 * (android/.../car/CarApi.java), ranked cheapest-first and priced for the
 * stay in Singapore time, with live free lots and EV status: the same list
 * the phone's Results screen shows (see _car/results.ts). Live counts
 * change every minute, so responses are not cached.
 */
import type { DbCarparkRaw } from '../../src/lib/api/dbCarparks';
import type { LtaCarpark } from '../../src/lib/api/lta';
import type { JustParkLot } from '../../src/lib/api/justpark';
import type { EvAvailabilityResponse } from '../../src/lib/api/ltaEv';
import type { NearbyGooglePlace } from '../../src/lib/api/googlePlaces';
import { getHdbAvailability } from '../../src/lib/api/hdb';
import { CARPARK_SELECT } from '../../src/lib/carparkSelect';
import { haversineMeters } from '../../src/lib/geo';
import { buildCarResults, sgWallClock } from '../_car/results';

export const config = { runtime: 'edge' };

const URL_BASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const RADIUS_M = 600; // the phone's default search radius (src/lib/radius.ts)
const GOOGLE_GAP_THRESHOLD = 5; // as src/lib/config.ts: gap-fill sparse areas
const DEG_LAT_PER_M = 1 / 111_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Resolves to null instead of throwing or hanging: one slow feed must not sink the list. */
async function soft<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

async function fetchRows(lat: number, lng: number): Promise<DbCarparkRaw[]> {
  const dLat = RADIUS_M * DEG_LAT_PER_M;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  const params = new URLSearchParams({ select: CARPARK_SELECT });
  params.append('lat', `gte.${lat - dLat}`);
  params.append('lat', `lte.${lat + dLat}`);
  params.append('lng', `gte.${lng - dLng}`);
  params.append('lng', `lte.${lng + dLng}`);
  params.append('limit', '300');
  const res = await fetch(`${URL_BASE}/rest/v1/carparks?${params}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`carparks ${res.status}`);
  const rows = (await res.json()) as DbCarparkRaw[];
  return rows.filter(
    (r) => r.lat != null && r.lng != null && haversineMeters({ lat, lng }, { lat: r.lat, lng: r.lng }) <= RADIUS_M,
  );
}

/** Our own live-data proxies, called by absolute URL so their keys and caches stay in one place. */
async function self<T>(req: Request, path: string): Promise<T> {
  const res = await fetch(new URL(path, req.url));
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

function evAgeMinutes(lastUpdatedTime: string): number {
  const t = Date.parse(lastUpdatedTime.replace(' ', 'T') + '+08:00'); // SGT timestamp
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 60_000)) : Number.POSITIVE_INFINITY;
}

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  // Singapore only: anything else has no carparks and isn't worth a query.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 1.1 || lat > 1.5 || lng < 103.5 || lng > 104.1) {
    return json({ ok: false, error: 'wheretopark.sg covers Singapore only' }, 400);
  }
  const hours = Math.min(24, Math.max(0.5, Math.round(Number(q.get('hours') || 2) * 2) / 2));
  const limit = Math.min(20, Math.max(1, Math.floor(Number(q.get('limit') || 12))));
  const label = q.get('label')?.trim() || undefined;
  if (!URL_BASE || !ANON_KEY) return json({ ok: false, error: 'Server not configured' }, 500);

  const [rows, hdb, lta, jp, ev] = await Promise.all([
    soft(fetchRows(lat, lng), 8000),
    soft(getHdbAvailability(), 5000),
    soft(self<{ carparks: LtaCarpark[] }>(req, '/api/lta-availability'), 8000),
    soft(self<{ carparks: JustParkLot[] }>(req, '/api/justpark-availability'), 8000),
    soft(self<EvAvailabilityResponse>(req, '/api/lta-ev-availability'), 8000),
  ]);
  if (!rows) return json({ ok: false, error: 'Carpark data is unavailable right now' }, 502);

  // Sparse areas: fill in from Google, as the phone does (never stored).
  let google: NearbyGooglePlace[] = [];
  if (rows.length < GOOGLE_GAP_THRESHOLD) {
    const g = await soft(
      self<{ ok: boolean; places?: NearbyGooglePlace[] }>(
        req,
        `/api/google-places-nearby?lat=${lat}&lng=${lng}&radius=${RADIUS_M}`,
      ),
      8000,
    );
    google = g?.places ?? [];
  }

  const carparks = buildCarResults({
    dest: { lat, lng, label },
    rows,
    hdb,
    lta: lta?.carparks ?? null,
    justpark: jp?.carparks ?? null,
    ev: ev ? { locations: ev.locations, ageMinutes: evAgeMinutes(ev.lastUpdatedTime) } : null,
    google,
    hours,
    now: sgWallClock(),
    limit,
  });
  return json({ ok: true, hours, live: !!(hdb || lta), carparks });
}
