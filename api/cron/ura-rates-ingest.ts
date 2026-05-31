// Vercel Serverless (Node.js) function — daily URA rate ingest.
//
// Wired to a cron in vercel.json (02:00 SGT / 18:00 UTC). Vercel attaches
// `Authorization: Bearer <CRON_SECRET>` to cron invocations; we reject any
// request that doesn't carry it so the endpoint can't be triggered publicly.
//
// The ingest itself lives in src/lib/server/uraIngest.ts — the same module
// the CLI (scripts/ingest-ura-rates.ts) runs — so cron and manual runs stay
// in lockstep.
//
// Runs on the Node.js runtime (not Edge): it needs the service-role
// Supabase key and a generous time budget for the full-refresh write.
//
// Env vars:
//   CRON_SECRET                auto-set by Vercel for cron jobs
//   URA_ACCESS_KEY             URA Data Service AccessKey
//   SUPABASE_URL               Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  service-role key (bypasses RLS for writes)
//
// Response:
//   200 { ok: true, upserted }
//   401 { ok: false, error }   missing / bad CRON_SECRET
//   500 { ok: false, error }   missing env or ingest failure

import type { IncomingMessage, ServerResponse } from 'http';

import { ingestUraRates } from '../../src/lib/server/uraIngest';

export const config = { maxDuration: 60 };

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers['authorization'];
  if (!secret || auth !== `Bearer ${secret}`) {
    return send(res, 401, { ok: false, error: 'unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessKey = process.env.URA_ACCESS_KEY;
  if (!supabaseUrl || !serviceRoleKey || !accessKey) {
    return send(res, 500, {
      ok: false,
      error:
        'missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and URA_ACCESS_KEY are required',
    });
  }

  try {
    const result = await ingestUraRates({
      supabaseUrl,
      serviceRoleKey,
      accessKey,
    });
    return send(res, 200, { ok: true, upserted: result.upserted });
  } catch (err) {
    return send(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}
