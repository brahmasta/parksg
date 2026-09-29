// Vercel edge function — fetches CapitaLand JustPark live lot availability and
// returns it keyed by our DB carpark ids.
//
// Edge, like every other route here, because edge functions are bundled. On the
// Node runtime this file was deployed unbundled as ESM, so the extensionless
// '../src/lib/server/justpark' import failed to resolve and every request died
// with 500 FUNCTION_INVOCATION_FAILED. The antiforgery handshake's Set-Cookie
// replay still works: the Edge Runtime implements Headers.getSetCookie(), and
// collectCookies() falls back to a date-safe split of the merged header.
//
// No secret/API key is involved — the data is public — so unlike the LTA proxy
// this exists mainly to (a) do the two-step antiforgery dance server-side and
// (b) project SiteCodes onto our carpark ids so the browser can merge directly.
//
// A 60s module-scope cache shares one upstream handshake across browser
// sessions in quick succession (same pattern as api/lta-availability.ts).

import { fetchJustParkLive, toCarparkLots, type JustParkLots } from '../src/lib/server/justpark';

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 60_000;

let cache: { ts: number; data: JustParkLots[] } | null = null;

export default async function handler(_req: Request): Promise<Response> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return json({ carparks: cache.data, cached: true }, 200, ageSeconds(cache.ts));
  }
  try {
    const sites = await fetchJustParkLive();
    const carparks = toCarparkLots(sites);
    cache = { ts: Date.now(), data: carparks };
    return json({ carparks, cached: false }, 200, 0);
  } catch (err) {
    // If we have a recent-ish stale cache, prefer serving it over a hard error
    // so a transient antiforgery blip doesn't blank out live counts.
    if (cache) {
      return json({ carparks: cache.data, cached: true, stale: true }, 200, ageSeconds(cache.ts));
    }
    return json(
      { error: 'JustPark fetch failed', detail: err instanceof Error ? err.message : String(err) },
      502,
    );
  }
}

function json(body: unknown, status: number, cacheAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${Math.max(0, 60 - cacheAge)}, must-revalidate`,
    },
  });
}

function ageSeconds(ts: number) {
  return Math.floor((Date.now() - ts) / 1000);
}
