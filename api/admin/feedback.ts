/** Admin feedback — list inaccuracy reports, update their triage status. */
import { verifyAdmin, json } from '../_admin/auth';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';

export const config = { runtime: 'edge' };

const STATUSES = ['new', 'reviewing', 'resolved', 'dismissed'];

export default async function handler(req: Request): Promise<Response> {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ error: admin.message }, admin.status);
  if (!hasServiceConfig()) return json({ error: 'Server not configured.' }, 500);

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
    if (!body?.id || !body.status || !STATUSES.includes(body.status))
      return json({ error: 'Invalid update.' }, 400);
    const r = await fetch(
      `${SB_URL}/rest/v1/inaccuracy_reports?id=eq.${encodeURIComponent(body.id)}`,
      {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: body.status }),
      },
    );
    if (!r.ok) return json({ error: 'Update failed.' }, 502);
    return json({ ok: true });
  }

  // GET: list reports, newest first, optionally filtered by status.
  const status = new URL(req.url).searchParams.get('status');
  const params = new URLSearchParams({ select: '*', order: 'created_at.desc', limit: '300' });
  if (status && STATUSES.includes(status)) params.set('status', `eq.${status}`);
  const r = await fetch(`${SB_URL}/rest/v1/inaccuracy_reports?${params}`, {
    headers: sbHeaders(),
  });
  if (!r.ok) return json({ error: 'Query failed.' }, 502);
  return json({ reports: await r.json() });
}
