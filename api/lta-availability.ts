// Vercel Edge function — proxies LTA Datamall CarParkAvailabilityv2 so the
// API key never reaches the browser.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   LTA_ACCOUNT_KEY  required, from datamall.lta.gov.sg
//
// We aggregate all paginated pages server-side, then return a single JSON
// array of {id, agency, name, area, lat, lng, lotsAvailable, lotType}
// shaped for direct consumption by the frontend.
//
// A short in-memory cache (60s) softens the load on LTA — multiple browser
// sessions in quick succession share one upstream call. The cache lives in
// the edge runtime's module scope; on a cold start it's empty, which is
// fine.

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2';
const PAGE_SIZE = 500;
const CACHE_TTL_MS = 60_000;

type LtaValue = {
  CarParkID: string;
  Area?: string;
  Development?: string;
  Location?: string;
  AvailableLots?: number;
  LotType?: string;
  Agency?: string;
};

type Carpark = {
  id: string;
  agency: 'HDB' | 'URA' | 'LTA';
  name: string;
  area: string;
  lat: number;
  lng: number;
  lotsAvailable: number;
  lotType: string;
};

let cache: { ts: number; data: Carpark[] } | null = null;

export default async function handler(_req: Request): Promise<Response> {
  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) {
    return json({ error: 'LTA_ACCOUNT_KEY env var is not set on the server' }, 500);
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return json({ carparks: cache.data, cached: true }, 200, ageSeconds(cache.ts));
  }

  try {
    const all: LtaValue[] = [];
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const url = skip === 0 ? UPSTREAM : `${UPSTREAM}?$skip=${skip}`;
      const res = await fetch(url, {
        headers: { AccountKey: key, accept: 'application/json' },
      });
      if (!res.ok) {
        return json(
          { error: `LTA upstream returned ${res.status}` },
          res.status === 401 ? 500 : 502,
        );
      }
      const body = (await res.json()) as { value?: LtaValue[] };
      const page = body.value ?? [];
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
      // Safety cap: LTA exposes <5000 carparks. Avoid infinite loops.
      if (skip > 10_000) break;
    }

    const carparks = all.map(normalize).filter((c): c is Carpark => c != null);
    cache = { ts: Date.now(), data: carparks };
    return json({ carparks, cached: false }, 200, 0);
  } catch (err) {
    return json(
      { error: 'Proxy failed', detail: err instanceof Error ? err.message : String(err) },
      502,
    );
  }
}

function normalize(v: LtaValue): Carpark | null {
  if (!v.CarParkID || !v.Location) return null;
  const [latStr, lngStr] = v.Location.split(/\s+/);
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const agency = (v.Agency ?? '').toUpperCase();
  if (agency !== 'HDB' && agency !== 'URA' && agency !== 'LTA') return null;
  return {
    id: v.CarParkID.trim(),
    agency,
    name: v.Development?.trim() || v.CarParkID.trim(),
    area: v.Area?.trim() || '',
    lat,
    lng,
    lotsAvailable: Number(v.AvailableLots) || 0,
    lotType: v.LotType ?? 'C',
  };
}

function json(body: unknown, status: number, cacheAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Browser may keep the response for 60s before re-asking; the CDN does
      // not cache (must-revalidate) so we always have a fresh route.
      'cache-control': `public, max-age=${Math.max(0, 60 - cacheAge)}, must-revalidate`,
    },
  });
}

function ageSeconds(ts: number) {
  return Math.floor((Date.now() - ts) / 1000);
}
