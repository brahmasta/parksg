// Vercel Edge function — proxies URA Data Service Car_Park_Details so the
// AccessKey + daily Token never reach the browser.
//
// URA's auth flow (annoying but well-documented):
//   1) Hold a static AccessKey (registered with URA, stored in env).
//   2) Call /insertNewToken/v1 with header AccessKey to mint a 24h Token.
//   3) Data calls send BOTH headers: AccessKey + Token.
//   4) Tokens rotate daily. On 401 we drop our cached token and re-mint
//      once. Single retry — no loop.
//
// Caching mirrors the existing onemap-route token cache + lta-availability
// data cache: in-memory module scope, no external KV. Edge runtime keeps
// warm instances alive for hours, so a Vercel deployment will mint just a
// handful of tokens per day. Cold starts re-mint, which is fine — URA's
// daily endpoint is designed for that.
//
// Env vars:
//   URA_ACCESS_KEY  required, register at https://www.ura.gov.sg/maps/api/
//
// Response shape:
//   200 { ok: true, fetchedAt, count, items: [...] }
//   500 { ok: false, error }   missing key
//   502 { ok: false, error }   upstream failure

export const config = { runtime: 'edge' };

const TOKEN_URL =
  'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1';
const DETAILS_URL =
  'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=Car_Park_Details';

// URA tokens are valid for ~24h. Refresh ~30 min before expiry to avoid
// mid-request invalidation.
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;
// Rates change very rarely — long data cache is safe on warm instances.
const DATA_TTL_MS = 6 * 60 * 60 * 1000;

type TokenCache = { token: string; expiresAt: number };
let cachedToken: TokenCache | null = null;

type DataCache = { ts: number; items: unknown[] };
let cachedData: DataCache | null = null;

type TokenResponse = {
  Status?: string;
  Result?: string;
  Message?: string;
};

type DetailsResponse = {
  Status?: string;
  Result?: unknown[];
  Message?: string;
};

export default async function handler(_req: Request): Promise<Response> {
  const accessKey = process.env.URA_ACCESS_KEY;
  if (!accessKey) {
    return json(
      { ok: false, error: 'URA_ACCESS_KEY env var is not set on the server' },
      500,
    );
  }

  if (cachedData && Date.now() - cachedData.ts < DATA_TTL_MS) {
    return json(
      {
        ok: true,
        fetchedAt: new Date(cachedData.ts).toISOString(),
        count: cachedData.items.length,
        items: cachedData.items,
        cached: true,
      },
      200,
      cacheMaxAge(cachedData.ts, DATA_TTL_MS),
    );
  }

  try {
    // First attempt with whatever token we have (mints one if cold).
    let token = await getToken(accessKey, false);
    let res = await fetchDetails(accessKey, token);

    // 401 / 403 → URA invalidated the token (likely the daily rotation
    // landed during our cache window). Drop it and retry exactly once.
    if (res.status === 401 || res.status === 403) {
      cachedToken = null;
      token = await getToken(accessKey, true);
      res = await fetchDetails(accessKey, token);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json(
        {
          ok: false,
          error: `URA Car_Park_Details returned ${res.status}`,
          detail: detail.slice(0, 300),
        },
        502,
      );
    }

    const body = (await res.json()) as DetailsResponse;
    if (body.Status !== 'Success' || !Array.isArray(body.Result)) {
      return json(
        {
          ok: false,
          error: 'URA response not OK',
          detail: (body.Message ?? JSON.stringify(body)).slice(0, 300),
        },
        502,
      );
    }

    cachedData = { ts: Date.now(), items: body.Result };
    return json(
      {
        ok: true,
        fetchedAt: new Date(cachedData.ts).toISOString(),
        count: cachedData.items.length,
        items: cachedData.items,
        cached: false,
      },
      200,
      Math.floor(DATA_TTL_MS / 1000),
    );
  } catch (err) {
    return json(
      {
        ok: false,
        error: 'URA fetch failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}

async function getToken(accessKey: string, force: boolean): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const res = await fetch(TOKEN_URL, {
    headers: { AccessKey: accessKey, 'User-Agent': 'wheretopark.sg' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`token mint ${res.status}: ${body.slice(0, 200)}`);
  }
  const body = (await res.json()) as TokenResponse;
  if (body.Status !== 'Success' || !body.Result) {
    throw new Error(
      `token mint failed: ${(body.Message ?? JSON.stringify(body)).slice(0, 200)}`,
    );
  }
  cachedToken = {
    token: body.Result,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  return cachedToken.token;
}

async function fetchDetails(accessKey: string, token: string): Promise<Response> {
  return fetch(DETAILS_URL, {
    headers: {
      AccessKey: accessKey,
      Token: token,
      'User-Agent': 'wheretopark.sg',
    },
  });
}

function cacheMaxAge(ts: number, ttlMs: number): number {
  return Math.max(0, Math.floor((ttlMs - (Date.now() - ts)) / 1000));
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
