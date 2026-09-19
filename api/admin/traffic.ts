/**
 * Admin traffic audit — visitor populations (human vs automated), traffic
 * sources, the conversion funnel and the 7-day return rate.
 *
 * Companion to /api/admin/analytics. That route reports raw counts; this one
 * reports what those counts actually mean once crawler traffic on the SSR/SEO
 * routes is separated out. Same auth + service-role pattern.
 */
import { verifyAdmin, json, ADMIN_EMAILS } from '../_admin/auth';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ error: admin.message }, admin.status);
  if (!hasServiceConfig())
    return json({ error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY).' }, 500);

  const url = new URL(req.url);
  const raw = parseInt(url.searchParams.get('days') || '30', 10);
  const days = Math.min(90, Math.max(1, Number.isFinite(raw) ? raw : 30));

  const excludeParam = url.searchParams.get('exclude_admin');
  const exclude = (excludeParam === '1' || excludeParam === 'true') && ADMIN_EMAILS.length > 0;

  const rpcBody: Record<string, unknown> = { p_days: days };
  if (exclude) rpcBody.p_exclude_emails = ADMIN_EMAILS;

  // Two independent RPCs: the traffic audit (visits/search_events, live now)
  // and the event funnel (app_events, fills in as instrumented traffic lands).
  // Fetched together so the dashboard renders in one pass.
  const [traffic, events] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/rpc/admin_traffic_analytics`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify(rpcBody),
    }),
    fetch(`${SB_URL}/rest/v1/rpc/admin_event_analytics`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify(rpcBody),
    }),
  ]);

  if (!traffic.ok) return json({ error: 'Traffic query failed.' }, 502);

  return json({
    ...(await traffic.json()),
    // A failed event query is non-fatal — the traffic audit is the headline,
    // and app_events is empty until the instrumentation ships.
    events: events.ok ? await events.json() : null,
  });
}
