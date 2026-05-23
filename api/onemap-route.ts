// Vercel Edge function — OneMap walking-route proxy.
//
// OneMap's routing endpoint now requires an Authorization: Bearer <token>
// header. The token is obtained by POSTing email+password to their auth
// endpoint and lasts ~3 days. We hold the email+password as server-side env
// vars and cache the resulting token in this module's scope so warm
// instances re-use it; a cold start re-auths once.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   ONEMAP_EMAIL     required
//   ONEMAP_PASSWORD  required
//
// Query params:
//   start  "<lat>,<lng>"  required
//   end    "<lat>,<lng>"  required
//
// Returns:
//   200 { ok: true, distance: meters, time: seconds }
//   400 { ok: false, error }   bad input
//   500 { ok: false, error }   auth or routing failure
//
// The frontend treats any non-200 as "fall back to haversine" rather than
// surfacing a hard error — walking-route is a polish layer.

export const config = { runtime: 'edge' };

const AUTH_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
const ROUTE_URL = 'https://www.onemap.gov.sg/api/public/routingsvc/route';

type TokenCache = { token: string; expiresAt: number };
let cachedToken: TokenCache | null = null;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end || !isLatLng(start) || !isLatLng(end)) {
    return json({ ok: false, error: 'start and end must be "lat,lng"' }, 400);
  }

  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) {
    return json(
      { ok: false, error: 'ONEMAP_EMAIL / ONEMAP_PASSWORD not set on the server' },
      500,
    );
  }

  let token: string;
  try {
    token = await getOneMapToken(email, password);
  } catch (err) {
    return json(
      { ok: false, error: 'OneMap auth failed', detail: err instanceof Error ? err.message : String(err) },
      500,
    );
  }

  const routeUrl = new URL(ROUTE_URL);
  routeUrl.searchParams.set('start', start);
  routeUrl.searchParams.set('end', end);
  routeUrl.searchParams.set('routeType', 'walk');

  try {
    const res = await fetch(routeUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      // Token went stale — drop it so the next call re-auths.
      cachedToken = null;
      return json({ ok: false, error: `OneMap returned ${res.status}` }, 502);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return json(
        { ok: false, error: `OneMap returned ${res.status}`, detail: body.slice(0, 200) },
        502,
      );
    }
    const body = (await res.json()) as {
      route_summary?: { total_distance?: number; total_time?: number };
      route_geometry?: string;
      status?: number;
      status_message?: string;
    };
    if (body.status !== 0 || !body.route_summary) {
      return json(
        { ok: false, error: body.status_message || 'No route' },
        502,
      );
    }
    return json(
      {
        ok: true,
        distance: Math.round(body.route_summary.total_distance ?? 0),
        time: Math.round(body.route_summary.total_time ?? 0),
        // Raw Google-encoded polyline (precision 5). Client decodes.
        geometry: body.route_geometry ?? '',
      },
      200,
      // Walking routes don't change. Browser may cache for a day.
      86400,
    );
  } catch (err) {
    return json(
      { ok: false, error: 'OneMap fetch failed', detail: err instanceof Error ? err.message : String(err) },
      502,
    );
  }
}

async function getOneMapToken(email: string, password: string): Promise<string> {
  // Refresh ~5 minutes before actual expiry to avoid mid-request invalidation.
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.token;
  }
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`auth ${res.status}: ${body.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    access_token?: string;
    expiry_timestamp?: string | number;
  };
  if (!body.access_token) throw new Error('auth response missing access_token');
  const expiryMs = Number(body.expiry_timestamp) * 1000;
  cachedToken = {
    token: body.access_token,
    expiresAt: Number.isFinite(expiryMs) && expiryMs > Date.now()
      ? expiryMs
      : Date.now() + 60 * 60 * 1000, // safety: 1 hour
  };
  return cachedToken.token;
}

function isLatLng(s: string): boolean {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(s);
  if (!m) return false;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng);
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
