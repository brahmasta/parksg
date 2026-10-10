/**
 * Admin data health — per-source rate freshness and the latest ingest runs,
 * with the same verdicts the daily /api/cron/data-health check alerts on.
 * Read-only. Same auth + service-role pattern as the other admin routes.
 */
import { verifyAdmin, json } from '../_admin/auth';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';
import { evaluateFreshness, type FreshnessReport } from '../../src/lib/server/dataFreshness';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ error: admin.message }, admin.status);
  if (!hasServiceConfig()) return json({ error: 'Server not configured.' }, 500);

  const r = await fetch(`${SB_URL}/rest/v1/rpc/admin_data_freshness`, {
    method: 'POST',
    headers: sbHeaders(),
    body: '{}',
  });
  // 404 = migration 019 not applied yet; the dashboard hides the panel.
  if (!r.ok) return json({ error: 'Data health query failed.' }, r.status === 404 ? 404 : 502);

  const report = (await r.json()) as FreshnessReport;
  return json({ ...report, verdicts: evaluateFreshness(report) });
}
