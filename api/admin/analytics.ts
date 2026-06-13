/** Admin analytics — DAU, searches, device split, referrers, top searches. */
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

  // When the dashboard's "Exclude admin" toggle is on, drop the admin
  // accounts' own activity (by their user_id + associated client_ids) from
  // every metric. Falls back to no exclusion if ADMIN_EMAILS is unset.
  const excludeParam = url.searchParams.get('exclude_admin');
  const exclude = (excludeParam === '1' || excludeParam === 'true') && ADMIN_EMAILS.length > 0;

  // Only attach p_exclude_emails when actually excluding, so the default path
  // stays compatible with the RPC's single-arg signature.
  const rpcBody: Record<string, unknown> = { p_days: days };
  if (exclude) rpcBody.p_exclude_emails = ADMIN_EMAILS;

  const r = await fetch(`${SB_URL}/rest/v1/rpc/admin_analytics`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(rpcBody),
  });
  if (!r.ok) return json({ error: 'Analytics query failed.' }, 502);
  return json(await r.json());
}
