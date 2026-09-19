// Vercel Serverless (Node.js) function — daily retention sweep for app_events.
//
// Wired to a cron in vercel.json (03:00 SGT / 19:00 UTC, an hour after the URA
// ingest so the two never contend). Vercel attaches
// `Authorization: Bearer <CRON_SECRET>` to cron invocations; anything without it
// is rejected, so the endpoint can't be triggered publicly. Same pattern as
// api/cron/ura-rates-ingest.ts.
//
// app_events records every tracked button press, so unlike visits/search_events
// it grows without a natural ceiling. The actual delete lives in the
// SECURITY DEFINER `prune_app_events` RPC (db/migrations/008) rather than a
// PostgREST DELETE: the RPC batches in 5k-row chunks, which keeps each
// transaction short, and it avoids the short statement_timeout that PostgREST's
// `authenticator` role runs under. The function is service-role-only — it is
// the one RPC in this schema that is not anon-callable.
//
// Runs on the Node.js runtime (not Edge): it needs the service-role key and a
// generous time budget for the first sweep that finds a real backlog.
//
// Env vars:
//   CRON_SECRET                auto-set by Vercel for cron jobs
//   SUPABASE_URL               Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  service-role key (bypasses RLS)
//
// Response:
//   200 { ok: true, deleted, months }
//   401 { ok: false, error }   missing / bad CRON_SECRET
//   500 { ok: false, error }   missing env or RPC failure

import type { IncomingMessage, ServerResponse } from 'http';

export const config = { maxDuration: 60 };

/** Rows older than this are dropped. A year keeps year-on-year comparisons
 *  possible while bounding the table. */
const RETENTION_MONTHS = 12;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers['authorization'];
  if (!secret || auth !== `Bearer ${secret}`) {
    return send(res, 401, { ok: false, error: 'unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return send(res, 500, {
      ok: false,
      error: 'missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    });
  }

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/prune_app_events`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_months: RETENTION_MONTHS }),
    });

    if (!r.ok) {
      const body = await r.text();
      return send(res, 500, {
        ok: false,
        error: `prune_app_events failed (${r.status}): ${body.slice(0, 300)}`,
      });
    }

    // The RPC returns the number of rows deleted as a bare JSON integer.
    const deleted = (await r.json()) as number;
    return send(res, 200, { ok: true, deleted, months: RETENTION_MONTHS });
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
