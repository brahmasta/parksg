/**
 * Admin carpark editor.
 *  GET ?q=<text>     → search carparks (name / id / slug / address)
 *  GET ?id=<id>      → one carpark + its rate_rows
 *  POST { id, meta?, rates? } → update metadata and/or replace the rate schedule
 *  PUT  { meta, rates? }      → create a new (MANUAL) carpark + its rates
 *
 * Rate edits are written as source='MANUAL' (the curated/authoritative source),
 * replacing the carpark's existing rows. The migrate scripts guard MANUAL rows
 * from being clobbered by re-ingest.
 */
import { verifyAdmin, json } from '../_admin/auth';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';
import { parseRates, replaceRateRows, createCarpark } from '../_admin/carparkWrite';

export const config = { runtime: 'edge' };

const CARPARK_FIELDS =
  'id,slug,agency,source,source_code,name,address,lat,lng,total_lots,central_area,car_park_type,parking_system';
const RATE_FIELDS =
  'id,day_type,start_time,end_time,first_hour_cents,per_block_cents,block_minutes,per_entry_cents,cap_cents,grace_minutes,system,veh_cat,source,effective_from';

export default async function handler(req: Request): Promise<Response> {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ error: admin.message }, admin.status);
  if (!hasServiceConfig()) return json({ error: 'Server not configured.' }, 500);

  const url = new URL(req.url);

  // ── Read ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      const r = await fetch(
        `${SB_URL}/rest/v1/carparks?id=eq.${encodeURIComponent(id)}&select=${CARPARK_FIELDS},rate_rows(${RATE_FIELDS})&limit=1`,
        { headers: sbHeaders() },
      );
      if (!r.ok) return json({ error: 'Query failed.' }, 502);
      const rows = (await r.json()) as unknown[];
      if (!rows[0]) return json({ error: 'Carpark not found.' }, 404);
      return json({ carpark: rows[0] });
    }
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return json({ carparks: [] });
    // Strip anything that could break the PostgREST filter; spaces → wildcard.
    const term = q.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '%');
    if (!term) return json({ carparks: [] });
    const or = `or=(name.ilike.*${term}*,id.ilike.*${term}*,slug.ilike.*${term}*,address.ilike.*${term}*)`;
    const r = await fetch(
      `${SB_URL}/rest/v1/carparks?${or}&select=${CARPARK_FIELDS}&order=name.asc&limit=30`,
      { headers: sbHeaders() },
    );
    if (!r.ok) return json({ error: 'Search failed.' }, 502);
    return json({ carparks: await r.json() });
  }

  // ── Write ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as
      | { id?: string; meta?: Record<string, unknown>; rates?: unknown[] }
      | null;
    if (!body?.id) return json({ error: 'Missing carpark id.' }, 400);
    const id = String(body.id);

    // 1. Metadata patch
    if (body.meta) {
      const m = body.meta;
      const patch: Record<string, unknown> = {};
      if (typeof m.name === 'string' && m.name.trim()) patch.name = m.name.trim().slice(0, 200);
      if (typeof m.address === 'string') patch.address = m.address.trim().slice(0, 300) || null;
      else if (m.address === null) patch.address = null;
      if (typeof m.lat === 'number' || m.lat === null) patch.lat = m.lat;
      if (typeof m.lng === 'number' || m.lng === null) patch.lng = m.lng;
      if (typeof m.total_lots === 'number' || m.total_lots === null)
        patch.total_lots = m.total_lots === null ? null : Math.round(m.total_lots as number);
      if (typeof m.central_area === 'boolean') patch.central_area = m.central_area;
      if (typeof m.car_park_type === 'string') patch.car_park_type = m.car_park_type.trim().slice(0, 60) || null;
      else if (m.car_park_type === null) patch.car_park_type = null;
      if (Object.keys(patch).length > 0) {
        patch.last_synced = new Date().toISOString();
        const r = await fetch(`${SB_URL}/rest/v1/carparks?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: sbHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify(patch),
        });
        if (!r.ok)
          return json({ error: 'Metadata update failed.', detail: (await r.text()).slice(0, 200) }, 502);
      }
    }

    // 2. Rates — replace the whole set when provided.
    if (Array.isArray(body.rates)) {
      let rows: Record<string, unknown>[];
      try {
        rows = parseRates(body.rates, id);
      } catch (e) {
        return json({ error: (e as Error).message || 'Invalid rate row.' }, 400);
      }
      const res = await replaceRateRows(id, rows);
      if (!res.ok) return json({ error: res.error }, 502);
    }

    return json({ ok: true });
  }

  // ── Create ────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const body = (await req.json().catch(() => null)) as
      | { meta?: Record<string, unknown>; rates?: unknown[] }
      | null;
    if (!body?.meta) return json({ error: 'Missing carpark details.' }, 400);
    const res = await createCarpark(body.meta, body.rates);
    if (!res.ok) return json({ error: res.error }, res.status);
    return json({ ok: true, id: res.id, warning: res.warning });
  }

  return json({ error: 'Method not allowed.' }, 405);
}
