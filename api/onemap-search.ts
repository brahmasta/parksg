// Vercel Edge function — OneMap location search proxy.
//
// OneMap's "elastic search" endpoint is public (no token, unlike the routing
// endpoint in api/onemap-route.ts). We proxy it anyway to (a) normalize the
// shape for the client, (b) add a short cache, and (c) keep all OneMap traffic
// server-side. Used by the carpark location picker (admin add-form + the
// customer "Add a carpark" dialog).
//
// Query params:  q  required, the search text
// Returns:  200 { results: [{ name, address, lat, lng }] }

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://www.onemap.gov.sg/api/common/elastic/search';
const CACHE_TTL_MS = 60_000;

type OneMapResult = {
  SEARCHVAL?: string;
  BUILDING?: string;
  ADDRESS?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
};
type Place = { name: string; address: string; lat: number; lng: number };

const cache = new Map<string, { ts: number; data: Place[] }>();

export default async function handler(req: Request): Promise<Response> {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ results: [] });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return json({ results: hit.data });
  }

  try {
    const url = `${UPSTREAM}?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return json({ results: [] });
    const body = (await r.json()) as { results?: OneMapResult[] };
    const results: Place[] = (body.results ?? [])
      .map((x) => ({
        name: (x.BUILDING && x.BUILDING !== 'NIL' ? x.BUILDING : x.SEARCHVAL) || x.SEARCHVAL || '',
        address: x.ADDRESS || '',
        lat: Number(x.LATITUDE),
        lng: Number(x.LONGITUDE),
      }))
      .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .slice(0, 12);
    // Bound the cache so it can't grow without limit on a warm instance.
    if (cache.size > 200) cache.clear();
    cache.set(key, { ts: Date.now(), data: results });
    return json({ results });
  } catch {
    return json({ results: [] });
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
}
