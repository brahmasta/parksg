/** Admin analytics — DAU, searches, device split, referrers, top searches. */
import { verifyAdmin, json } from '../_admin/auth';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ error: admin.message }, admin.status);
  if (!hasServiceConfig())
    return json({ error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY).' }, 500);

  const raw = parseInt(new URL(req.url).searchParams.get('days') || '30', 10);
  const days = Math.min(90, Math.max(1, Number.isFinite(raw) ? raw : 30));

  const r = await fetch(`${SB_URL}/rest/v1/rpc/admin_analytics`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ p_days: days }),
  });
  if (!r.ok) return json({ error: 'Analytics query failed.' }, 502);
  return json(await r.json());
}
