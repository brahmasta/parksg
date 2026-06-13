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

export const config = { runtime: 'edge' };

const CARPARK_FIELDS =
  'id,slug,agency,source,source_code,name,address,lat,lng,total_lots,central_area,car_park_type,parking_system';
const RATE_FIELDS =
  'id,day_type,start_time,end_time,first_hour_cents,per_block_cents,block_minutes,per_entry_cents,cap_cents,grace_minutes,system,veh_cat,source,effective_from';

const DAY_TYPES = ['WEEKDAY', 'SAT', 'SUN_PH'];
const SYSTEMS = ['EPS', 'COUPON', 'GANTRY_PRIVATE', 'FLAT'];
const VEH = ['CAR', 'MOTORCYCLE', 'HEAVY'];
const AGENCIES = ['HDB', 'URA', 'LTA', 'JTC', 'NPARKS', 'OPERATOR'];

const intOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
const timeOrNull = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(v.trim()) ? v.trim() : null;

/** Normalize a raw rate-row array into DB rows (source=MANUAL). Throws on a
 * bad day_type. Shared by the create (PUT) and edit (POST) paths. */
function parseRates(raw: unknown[], carparkId: string): Record<string, unknown>[] {
  return raw.map((r) => {
    const row = r as Record<string, unknown>;
    if (!DAY_TYPES.includes(String(row.day_type)))
      throw new Error(`bad day_type: ${row.day_type}`);
    return {
      carpark_id: carparkId,
      day_type: row.day_type,
      start_time: timeOrNull(row.start_time),
      end_time: timeOrNull(row.end_time),
      first_hour_cents: intOrNull(row.first_hour_cents),
      per_block_cents: intOrNull(row.per_block_cents),
      block_minutes: intOrNull(row.block_minutes),
      per_entry_cents: intOrNull(row.per_entry_cents),
      cap_cents: intOrNull(row.cap_cents),
      grace_minutes: intOrNull(row.grace_minutes),
      system: SYSTEMS.includes(String(row.system)) ? row.system : 'EPS',
      veh_cat: VEH.includes(String(row.veh_cat)) ? row.veh_cat : 'CAR',
      source: 'MANUAL',
      effective_from:
        typeof row.effective_from === 'string' && row.effective_from ? row.effective_from : null,
    };
  });
}

/** Build a url-safe slug from free text (lowercase, underscores). */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

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

      const del = await fetch(
        `${SB_URL}/rest/v1/rate_rows?carpark_id=eq.${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) },
      );
      if (!del.ok) return json({ error: 'Could not clear existing rates.' }, 502);
      if (rows.length > 0) {
        const ins = await fetch(`${SB_URL}/rest/v1/rate_rows`, {
          method: 'POST',
          headers: sbHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify(rows),
        });
        if (!ins.ok)
          return json({ error: 'Rate save failed.', detail: (await ins.text()).slice(0, 300) }, 502);
      }
    }

    return json({ ok: true });
  }

  // ── Create ────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const body = (await req.json().catch(() => null)) as
      | { meta?: Record<string, unknown>; rates?: unknown[] }
      | null;
    const m = body?.meta;
    if (!m) return json({ error: 'Missing carpark details.' }, 400);

    const name = typeof m.name === 'string' ? m.name.trim() : '';
    if (!name) return json({ error: 'Name is required.' }, 400);

    const agency = String(m.agency || 'OPERATOR').toUpperCase();
    if (!AGENCIES.includes(agency)) return json({ error: `Invalid agency: ${agency}` }, 400);

    // source_code defaults to a slug of the name; id defaults to MANUAL:<code>.
    const sourceCode = (typeof m.source_code === 'string' && m.source_code.trim()
      ? slugify(m.source_code)
      : slugify(name)) || 'carpark';
    const id =
      typeof m.id === 'string' && m.id.trim()
        ? m.id.trim().slice(0, 80)
        : `MANUAL:${sourceCode}`;

    const parkingSystem =
      typeof m.parking_system === 'string' && SYSTEMS.includes(m.parking_system)
        ? m.parking_system
        : null;

    // Reject duplicates so we never silently overwrite an existing carpark.
    const existing = await fetch(
      `${SB_URL}/rest/v1/carparks?id=eq.${encodeURIComponent(id)}&select=id&limit=1`,
      { headers: sbHeaders() },
    );
    if (existing.ok) {
      const rows = (await existing.json()) as unknown[];
      if (rows[0]) return json({ error: `A carpark with id ${id} already exists.` }, 409);
    }

    const cp = {
      id,
      agency,
      source_code: sourceCode,
      name: name.slice(0, 200),
      address: typeof m.address === 'string' && m.address.trim() ? m.address.trim().slice(0, 300) : null,
      lat: typeof m.lat === 'number' && Number.isFinite(m.lat) ? m.lat : null,
      lng: typeof m.lng === 'number' && Number.isFinite(m.lng) ? m.lng : null,
      car_park_type: typeof m.car_park_type === 'string' && m.car_park_type.trim() ? m.car_park_type.trim().slice(0, 60) : null,
      parking_system: parkingSystem,
      central_area: m.central_area === true,
      total_lots: typeof m.total_lots === 'number' && Number.isFinite(m.total_lots) ? Math.round(m.total_lots) : null,
      source: 'MANUAL',
      slug: slugify(name),
      last_synced: new Date().toISOString(),
    };

    const ins = await fetch(`${SB_URL}/rest/v1/carparks`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(cp),
    });
    if (!ins.ok)
      return json({ error: 'Could not create carpark.', detail: (await ins.text()).slice(0, 300) }, 502);

    // Optional initial rate schedule.
    if (Array.isArray(body?.rates) && body.rates.length > 0) {
      let rows: Record<string, unknown>[];
      try {
        rows = parseRates(body.rates, id);
      } catch (e) {
        // Carpark was created; surface the rate problem but report the id so
        // the client can open it and fix the schedule.
        return json({ ok: true, id, warning: `Carpark created, but rates were rejected: ${(e as Error).message}` });
      }
      const rIns = await fetch(`${SB_URL}/rest/v1/rate_rows`, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify(rows),
      });
      if (!rIns.ok)
        return json({ ok: true, id, warning: 'Carpark created, but saving rates failed.' });
    }

    return json({ ok: true, id });
  }

  return json({ error: 'Method not allowed.' }, 405);
}
