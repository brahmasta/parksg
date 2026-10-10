// Vercel Serverless (Node.js) function — daily data-freshness check.
//
// Wired to a cron in vercel.json (04:00 SGT / 20:00 UTC, after the URA ingest
// at 02:00 and the app_events prune at 03:00). Same CRON_SECRET gate as the
// other cron handlers.
//
// Reads the read-only `admin_data_freshness` RPC (db/migrations/019) and
// applies the per-source rules in src/lib/server/dataFreshness.ts. When any
// source is `stale` — URA rates older than 2 days, or the last URA ingest run
// failed — the handler answers 500, so the run shows as failed in Vercel's
// cron view and triggers Vercel's failed-cron notification. That is the alert:
// no new notification channel, no keys leave the server.
//
// It only reports. It never writes rates or fills in missing data.
//
// Env vars:
//   CRON_SECRET                auto-set by Vercel for cron jobs
//   SUPABASE_URL               Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  service-role key
//
// Response:
//   200 { ok: true,  verdicts, report }   nothing stale
//   500 { ok: false, verdicts, report }   at least one source stale
//   401 / 500 { ok: false, error }        bad secret, missing env, RPC failure

import type { IncomingMessage, ServerResponse } from 'http';

import {
  evaluateFreshness,
  type FreshnessReport,
} from '../../src/lib/server/dataFreshness.js';

export const config = { maxDuration: 30 };

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
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_data_freshness`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!r.ok) {
      const body = await r.text();
      return send(res, 500, {
        ok: false,
        error: `admin_data_freshness failed (${r.status}): ${body.slice(0, 300)}`,
      });
    }

    const report = (await r.json()) as FreshnessReport;
    const verdicts = evaluateFreshness(report);
    const stale = verdicts.filter((v) => v.level === 'stale');
    if (stale.length > 0) {
      console.error(
        'data-health: stale sources —',
        stale.map((v) => `${v.source}: ${v.reason}`).join('; '),
      );
    }
    return send(res, stale.length > 0 ? 500 : 200, {
      ok: stale.length === 0,
      verdicts,
      report,
    });
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
