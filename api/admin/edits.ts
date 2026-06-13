/**
 * Admin moderation of community carpark edits.
 *   GET ?status=pending|approved|rejected  → list submissions (newest first)
 *   POST { id, action:'approve'|'reject', review_note? }
 *     - approve: apply proposed total_lots + rates as MANUAL, mark approved
 *     - reject:  mark rejected (nothing applied)
 */
import { verifyAdmin, json } from '../_admin/auth';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';
import { applyCarparkEdit, createCarpark } from '../_admin/carparkWrite';

export const config = { runtime: 'edge' };

const STATUSES = ['pending', 'approved', 'rejected'];
const FIELDS =
  'id,created_at,kind,carpark_id,carpark_name,carpark_source,submitter_user_id,submitter_email,submitter_name,proposed_total_lots,proposed_rates,proposed_carpark,note,status,reviewed_by,reviewed_at,review_note';

type Submission = {
  id: string;
  kind: 'edit' | 'new';
  carpark_id: string | null;
  proposed_total_lots: number | null;
  proposed_rates: unknown[];
  proposed_carpark: { name?: string; lat?: number; lng?: number; address?: string } | null;
  status: string;
};

export default async function handler(req: Request): Promise<Response> {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ error: admin.message }, admin.status);
  if (!hasServiceConfig()) return json({ error: 'Server not configured.' }, 500);

  // ── Approve / reject ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as
      | { id?: string; action?: string; review_note?: string }
      | null;
    if (!body?.id || (body.action !== 'approve' && body.action !== 'reject'))
      return json({ error: 'Invalid request.' }, 400);

    // Load the submission so we apply exactly what was proposed.
    const r = await fetch(
      `${SB_URL}/rest/v1/carpark_edit_submissions?id=eq.${encodeURIComponent(body.id)}&select=${FIELDS}&limit=1`,
      { headers: sbHeaders() },
    );
    if (!r.ok) return json({ error: 'Lookup failed.' }, 502);
    const sub = ((await r.json()) as Submission[])[0];
    if (!sub) return json({ error: 'Submission not found.' }, 404);
    if (sub.status !== 'pending')
      return json({ error: `Already ${sub.status}.` }, 409);

    if (body.action === 'approve') {
      const rates = Array.isArray(sub.proposed_rates) ? sub.proposed_rates : [];
      if (sub.kind === 'new') {
        const pc = sub.proposed_carpark || {};
        const created = await createCarpark(
          {
            name: pc.name,
            lat: pc.lat,
            lng: pc.lng,
            address: pc.address ?? null,
            total_lots: sub.proposed_total_lots ?? undefined,
          },
          rates,
        );
        if (!created.ok) return json({ error: created.error }, created.status);
      } else {
        if (!sub.carpark_id) return json({ error: 'Edit submission has no carpark id.' }, 400);
        const applied = await applyCarparkEdit(sub.carpark_id, {
          total_lots: sub.proposed_total_lots,
          rates,
        });
        if (!applied.ok) return json({ error: applied.error }, 502);
      }
    }

    const patch = {
      status: body.action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: admin.email,
      reviewed_at: new Date().toISOString(),
      review_note:
        typeof body.review_note === 'string' && body.review_note.trim()
          ? body.review_note.trim().slice(0, 1000)
          : null,
    };
    const upd = await fetch(
      `${SB_URL}/rest/v1/carpark_edit_submissions?id=eq.${encodeURIComponent(body.id)}`,
      { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) },
    );
    if (!upd.ok) return json({ error: 'Status update failed.' }, 502);
    return json({ ok: true });
  }

  // ── List ──────────────────────────────────────────────────────────────
  const status = new URL(req.url).searchParams.get('status');
  const params = new URLSearchParams({ select: FIELDS, order: 'created_at.desc', limit: '300' });
  if (status && STATUSES.includes(status)) params.set('status', `eq.${status}`);
  const r = await fetch(`${SB_URL}/rest/v1/carpark_edit_submissions?${params}`, {
    headers: sbHeaders(),
  });
  if (!r.ok) return json({ error: 'Query failed.' }, 502);
  return json({ submissions: await r.json() });
}
