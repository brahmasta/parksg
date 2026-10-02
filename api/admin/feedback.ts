/**
 * Admin feedback — list carpark inaccuracy reports (`kind=reports`, default) or
 * home-page app feedback (`kind=app`), update their triage status, and count
 * unread items (`counts=1`) for the Feedback tab's badge.
 */
import { verifyAdmin, json } from '../_admin/auth';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';

export const config = { runtime: 'edge' };

const STATUSES = ['new', 'reviewing', 'resolved', 'dismissed'];
const TABLES = { reports: 'inaccuracy_reports', app: 'app_feedback' } as const;
type Kind = keyof typeof TABLES;

const toKind = (v: unknown): Kind => (v === 'app' ? 'app' : 'reports');

/** Rows with status 'new', via PostgREST's exact count (no rows fetched). */
async function countNew(table: string): Promise<number | null> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?status=eq.new&select=id&limit=1`, {
    headers: sbHeaders({ Prefer: 'count=exact' }),
  });
  if (!r.ok) return null;
  const total = r.headers.get('content-range')?.split('/')[1];
  return total && total !== '*' ? Number(total) : null;
}

export default async function handler(req: Request): Promise<Response> {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ error: admin.message }, admin.status);
  if (!hasServiceConfig()) return json({ error: 'Server not configured.' }, 500);

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as
      | { id?: string; status?: string; kind?: string }
      | null;
    if (!body?.id || !body.status || !STATUSES.includes(body.status))
      return json({ error: 'Invalid update.' }, 400);
    const r = await fetch(
      `${SB_URL}/rest/v1/${TABLES[toKind(body.kind)]}?id=eq.${encodeURIComponent(body.id)}`,
      {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: body.status }),
      },
    );
    if (!r.ok) return json({ error: 'Update failed.' }, 502);
    return json({ ok: true });
  }

  const url = new URL(req.url);

  // GET ?counts=1: unread totals for the nav badge. A table that's missing
  // (migration 014 not applied yet) counts as null rather than failing.
  if (url.searchParams.get('counts')) {
    const [reports, app] = await Promise.all([countNew(TABLES.reports), countNew(TABLES.app)]);
    return json({ reports_new: reports, app_new: app });
  }

  // GET: list items, newest first, optionally filtered by status.
  const kind = toKind(url.searchParams.get('kind'));
  const status = url.searchParams.get('status');
  const params = new URLSearchParams({ select: '*', order: 'created_at.desc', limit: '300' });
  if (status && STATUSES.includes(status)) params.set('status', `eq.${status}`);
  const r = await fetch(`${SB_URL}/rest/v1/${TABLES[kind]}?${params}`, {
    headers: sbHeaders(),
  });
  if (!r.ok) return json({ error: 'Query failed.' }, 502);
  const rows = await r.json();
  return json(kind === 'app' ? { feedback: rows } : { reports: rows });
}
