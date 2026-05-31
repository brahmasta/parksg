// Vercel Edge function — issues the daily URA Data Service Token.
//
// URA's auth flow: a static AccessKey (registered with URA, server-side
// only) mints a 24h Token from /insertNewToken/v1. Tokens rotate daily, so
// we cache the minted token in Vercel KV under `ura_token` with a 23h TTL
// (refresh ~1h before URA's 24h expiry to avoid mid-request invalidation).
//
// The AccessKey never leaves the server. The browser only ever sees the
// short-lived Token via GET /api/ura-token.
//
// Env vars:
//   URA_ACCESS_KEY   required, register at https://www.ura.gov.sg/maps/api/
//
// Response shape:
//   200 { token }
//   500 { error }   missing AccessKey
//   502 { error }   URA token mint failed

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const TOKEN_URL =
  'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1';
const KV_KEY = 'ura_token';
// URA tokens live ~24h; expire our cache ~1h early.
const TOKEN_TTL_SECONDS = 23 * 60 * 60;

type TokenResponse = {
  Status?: string;
  Result?: string;
  Message?: string;
};

export default async function handler(_req: Request): Promise<Response> {
  const accessKey = process.env.URA_ACCESS_KEY;
  if (!accessKey) {
    return json({ error: 'URA_ACCESS_KEY env var is not set on the server' }, 500);
  }

  // KV is best-effort: if it's unprovisioned or unreachable we still mint a
  // fresh token so the endpoint keeps working — we just lose the daily cache.
  const cached = await kvGet(KV_KEY);
  if (cached) return json({ token: cached }, 200);

  let token: string;
  try {
    token = await mintToken(accessKey);
  } catch (err) {
    return json(
      {
        error: 'URA token mint failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }

  await kvSet(KV_KEY, token, TOKEN_TTL_SECONDS);
  return json({ token }, 200);
}

async function mintToken(accessKey: string): Promise<string> {
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
  return body.Result;
}

async function kvGet(key: string): Promise<string | null> {
  try {
    return await kv.get<string>(key);
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await kv.set(key, value, { ex: ttlSeconds });
  } catch {
    // KV unavailable — token is still returned to the caller uncached.
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
