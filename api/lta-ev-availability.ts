// Vercel Edge function — proxies LTA Datamall /EVCBatch (EV charger
// availability) so the AccountKey never reaches the browser, and so we
// can normalise the upstream's nested shape into the flat EVConnector
// form the app uses.
//
// LTA's flow:
//   1) GET /EVCBatch → { value: [{ Link: "<signed S3 url>" }] }
//   2) GET <signed url> → 3 MB JSON of every EV location in SG
//
// We do both upstream hops here, flatten the nested chargingPoints →
// plugTypes → evIds structure into one EVConnector per physical
// connector, and cache the result for 60s so a burst of searches share
// one upstream pull. LTA refreshes the underlying file every ~5 min.
//
// Both hops share one UPSTREAM_TIMEOUT_MS deadline. LTA is sometimes slow
// enough that the function used to run into the platform's 25s limit; now it
// answers 504 quickly and the app shows carparks without EV data. The app
// itself stops waiting after 10s, so the deadline sits under that.
//
// Env:
//   LTA_ACCOUNT_KEY  required, same key as /api/lta-availability.
//
// Returns:
//   200 { ok: true, lastUpdatedTime, count, locations: [...] }
//   500 { ok: false, error }   missing key
//   502 { ok: false, error }   upstream failure
//   504 { ok: false, error }   upstream too slow

export const config = { runtime: 'edge' };

const POLL_URL = 'https://datamall2.mytransport.sg/ltaodataservice/EVCBatch';
const CACHE_TTL_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 8_000;

type PollResponse = { value?: Array<{ Link?: string }> };

type RawEvId = { evCpId?: string; status?: string };
type RawPlugType = {
  plugType?: string;
  price?: string;
  current?: string;
  powerRating?: string;
  priceType?: string;
  evIds?: RawEvId[];
};
type RawChargingPoint = {
  status?: string;
  operatingHours?: string;
  operator?: string;
  position?: string;
  name?: string;
  plugTypes?: RawPlugType[];
};
type RawLocation = {
  address?: string;
  name?: string;
  longtitude?: number; // SIC — upstream spelling
  latitude?: number;
  postalCode?: string;
  chargingPoints?: RawChargingPoint[];
};
type RawDump = {
  LastUpdatedTime?: string;
  evLocationsData?: RawLocation[];
};

type Connector = {
  id: string;
  operator: string;
  position: string;
  hours: string;
  plugType: 'Type 2' | 'CCS2' | 'CHAdeMO' | 'GB/T';
  current: 'AC' | 'DC';
  kw: number;
  price: number;
  priceType: '/kWh' | '/h';
  status: 'Available' | 'Occupied' | 'Not Available';
};

type Location = {
  name: string;
  address: string;
  postalCode: string;
  lat: number;
  lng: number;
  connectors: Connector[];
};

type Cache = { ts: number; lastUpdatedTime: string; locations: Location[] };
let cache: Cache | null = null;

export default async function handler(_req: Request): Promise<Response> {
  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) {
    return json({ ok: false, error: 'LTA_ACCOUNT_KEY env var is not set' }, 500);
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return json(
      {
        ok: true,
        lastUpdatedTime: cache.lastUpdatedTime,
        count: cache.locations.length,
        locations: cache.locations,
        cached: true,
      },
      200,
      Math.max(0, 60 - Math.floor((Date.now() - cache.ts) / 1000)),
    );
  }

  // One deadline for both hops, including reading the 3 MB body.
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  try {
    // 1) Poll endpoint for the signed S3 URL.
    const pollRes = await fetch(POLL_URL, {
      headers: { AccountKey: key, accept: 'application/json' },
      signal,
    });
    if (!pollRes.ok) {
      const detail = await pollRes.text().catch(() => '');
      return json(
        { ok: false, error: `EVCBatch poll returned ${pollRes.status}`, detail: detail.slice(0, 300) },
        502,
      );
    }
    const poll = (await pollRes.json()) as PollResponse;
    const link = poll.value?.[0]?.Link;
    if (!link) {
      return json({ ok: false, error: 'EVCBatch poll response had no Link' }, 502);
    }

    // 2) Fetch the signed dump.
    const dumpRes = await fetch(link, { signal });
    if (!dumpRes.ok) {
      return json({ ok: false, error: `EV dump download returned ${dumpRes.status}` }, 502);
    }
    const dump = (await dumpRes.json()) as RawDump;
    const locations: Location[] = [];
    for (const raw of dump.evLocationsData ?? []) {
      const loc = normalizeLocation(raw);
      if (loc) locations.push(loc);
    }

    cache = {
      ts: Date.now(),
      lastUpdatedTime: dump.LastUpdatedTime ?? new Date().toISOString(),
      locations,
    };

    return json(
      {
        ok: true,
        lastUpdatedTime: cache.lastUpdatedTime,
        count: locations.length,
        locations,
        cached: false,
      },
      200,
      60,
    );
  } catch (err) {
    if (signal.aborted) {
      return json({ ok: false, error: `EVCBatch did not answer within ${UPSTREAM_TIMEOUT_MS / 1000}s` }, 504);
    }
    return json(
      {
        ok: false,
        error: 'EVCBatch fetch failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}

function normalizeLocation(raw: RawLocation): Location | null {
  const lat = raw.latitude;
  const lng = raw.longtitude;
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const connectors: Connector[] = [];
  for (const cp of raw.chargingPoints ?? []) {
    const operator = titleCase(cp.operator ?? '');
    const position = (cp.position ?? '').trim() || 'Bay';
    const hours = (cp.operatingHours ?? '').trim() || '24/7';
    for (const pt of cp.plugTypes ?? []) {
      const plug = normalizePlug(pt.plugType);
      if (!plug) continue;
      const current = pt.current === 'DC' ? 'DC' : 'AC';
      const kw = parseFloat(pt.powerRating ?? '0');
      const priceRaw = parseFloat(pt.price ?? '0');
      const price = Number.isFinite(priceRaw) ? priceRaw : 0;
      const priceType: Connector['priceType'] = pt.priceType === 'h' ? '/h' : '/kWh';
      for (const ev of pt.evIds ?? []) {
        if (!ev.evCpId) continue;
        connectors.push({
          id: ev.evCpId,
          operator,
          position,
          hours,
          plugType: plug,
          current,
          kw: Number.isFinite(kw) ? kw : 0,
          price,
          priceType,
          status: normalizeStatus(ev.status ?? cp.status),
        });
      }
    }
  }

  if (connectors.length === 0) return null;

  return {
    name: titleCase((raw.name ?? '').trim()),
    address: titleCase((raw.address ?? '').trim()),
    postalCode: raw.postalCode ?? '',
    lat,
    lng,
    connectors,
  };
}

function normalizePlug(p: string | undefined): Connector['plugType'] | null {
  switch ((p ?? '').trim()) {
    case 'Type 2':
      return 'Type 2';
    case 'Combo 2':
    case 'CCS2':
    case 'CCS 2':
      return 'CCS2';
    case 'CHAdeMO':
      return 'CHAdeMO';
    case 'GB/T':
    case 'GBT':
      return 'GB/T';
    default:
      return null;
  }
}

function normalizeStatus(s: string | undefined): Connector['status'] {
  if (s === '1') return 'Available';
  if (s === '0') return 'Occupied';
  return 'Not Available';
}

const ALL_CAPS = /\b(?:HDB|URA|LTA|MSCP|MRT|SMRT|CBD|JEM|VIP|PIE|BKE|TPE|KPE|ECP|NSE|AYE|CTE|ICA|SAFRA|NTUC|NUS|NTU|SMU|SIM|MBS|YTL|SP|EV|AC|DC|JLN|BLK|HQ|EM|HQT|YMCA|HC|MD)\b/gi;
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(ALL_CAPS, (m) => m.toUpperCase());
}

function json(body: unknown, status: number, browserCacheSec = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${browserCacheSec}, must-revalidate`,
    },
  });
}
