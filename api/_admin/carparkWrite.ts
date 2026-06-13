/**
 * Shared carpark write helpers (service-role). Used by the admin carpark editor
 * (api/admin/carparks.ts) and the community-edit approver (api/admin/edits.ts)
 * so both apply rate/lot changes identically — always as source='MANUAL', which
 * the ingest scripts guard from re-ingest clobber.
 */
import { SB_URL, sbHeaders } from './db';

export const DAY_TYPES = ['WEEKDAY', 'SAT', 'SUN_PH'];
export const SYSTEMS = ['EPS', 'COUPON', 'GANTRY_PRIVATE', 'FLAT'];
export const VEH = ['CAR', 'MOTORCYCLE', 'HEAVY'];
export const AGENCIES = ['HDB', 'URA', 'LTA', 'JTC', 'NPARKS', 'OPERATOR'];

/** Build a url-safe slug from free text (lowercase, underscores). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

const intOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
const timeOrNull = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(v.trim()) ? v.trim() : null;

/** Normalize a raw rate-row array into DB rows (source=MANUAL). Throws on a
 * bad day_type. */
export function parseRates(raw: unknown[], carparkId: string): Record<string, unknown>[] {
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

type Result = { ok: true } | { ok: false; error: string };

/** Replace a carpark's entire rate schedule with `rows` (already parsed). */
export async function replaceRateRows(
  carparkId: string,
  rows: Record<string, unknown>[],
): Promise<Result> {
  const del = await fetch(
    `${SB_URL}/rest/v1/rate_rows?carpark_id=eq.${encodeURIComponent(carparkId)}`,
    { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) },
  );
  if (!del.ok) return { ok: false, error: 'Could not clear existing rates.' };
  if (rows.length > 0) {
    const ins = await fetch(`${SB_URL}/rest/v1/rate_rows`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(rows),
    });
    if (!ins.ok)
      return { ok: false, error: `Rate save failed: ${(await ins.text()).slice(0, 200)}` };
  }
  return { ok: true };
}

/** Patch a carpark's total_lots (null clears it). */
async function patchTotalLots(carparkId: string, total: number | null): Promise<Result> {
  const r = await fetch(`${SB_URL}/rest/v1/carparks?id=eq.${encodeURIComponent(carparkId)}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      total_lots: total === null ? null : Math.round(total),
      last_synced: new Date().toISOString(),
    }),
  });
  return r.ok ? { ok: true } : { ok: false, error: 'total_lots update failed.' };
}

type CreateResult =
  | { ok: true; id: string; warning?: string }
  | { ok: false; status: number; error: string };

/**
 * Create a new carpark (source='MANUAL') from a metadata object + optional
 * rates. Derives id (`MANUAL:<slug>`) and source_code from the name when not
 * given, and rejects duplicates. Shared by the admin PUT create path and the
 * approval of a community 'new carpark' submission.
 */
export async function createCarpark(
  m: Record<string, unknown>,
  rates?: unknown[],
): Promise<CreateResult> {
  const name = typeof m.name === 'string' ? m.name.trim() : '';
  if (!name) return { ok: false, status: 400, error: 'Name is required.' };

  const agency = String(m.agency || 'OPERATOR').toUpperCase();
  if (!AGENCIES.includes(agency)) return { ok: false, status: 400, error: `Invalid agency: ${agency}` };

  const sourceCode =
    (typeof m.source_code === 'string' && m.source_code.trim() ? slugify(m.source_code) : slugify(name)) ||
    'carpark';
  const id =
    typeof m.id === 'string' && m.id.trim() ? m.id.trim().slice(0, 80) : `MANUAL:${sourceCode}`;

  const parkingSystem =
    typeof m.parking_system === 'string' && SYSTEMS.includes(m.parking_system) ? m.parking_system : null;

  // Reject duplicates so we never silently overwrite an existing carpark.
  const existing = await fetch(
    `${SB_URL}/rest/v1/carparks?id=eq.${encodeURIComponent(id)}&select=id&limit=1`,
    { headers: sbHeaders() },
  );
  if (existing.ok) {
    const rows = (await existing.json()) as unknown[];
    if (rows[0]) return { ok: false, status: 409, error: `A carpark with id ${id} already exists.` };
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
    // `slug` is a GENERATED column in Postgres — never insert it.
    last_synced: new Date().toISOString(),
  };

  const ins = await fetch(`${SB_URL}/rest/v1/carparks`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(cp),
  });
  if (!ins.ok)
    return { ok: false, status: 502, error: `Could not create carpark: ${(await ins.text()).slice(0, 200)}` };

  if (Array.isArray(rates) && rates.length > 0) {
    let rows: Record<string, unknown>[];
    try {
      rows = parseRates(rates, id);
    } catch (e) {
      return { ok: true, id, warning: `Carpark created, but rates were rejected: ${(e as Error).message}` };
    }
    const rIns = await fetch(`${SB_URL}/rest/v1/rate_rows`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(rows),
    });
    if (!rIns.ok) return { ok: true, id, warning: 'Carpark created, but saving rates failed.' };
  }

  return { ok: true, id };
}

/**
 * Apply a community edit: optionally set total_lots, optionally replace rates.
 * `rates` are raw (unparsed) rows — validated here. Pass `total_lots: undefined`
 * to leave lots untouched (null explicitly clears them).
 */
export async function applyCarparkEdit(
  carparkId: string,
  edit: { total_lots?: number | null; rates?: unknown[] },
): Promise<Result> {
  if (edit.total_lots !== undefined) {
    const res = await patchTotalLots(carparkId, edit.total_lots);
    if (!res.ok) return res;
  }
  if (Array.isArray(edit.rates)) {
    let rows: Record<string, unknown>[];
    try {
      rows = parseRates(edit.rates, carparkId);
    } catch (e) {
      return { ok: false, error: (e as Error).message || 'Invalid rate row.' };
    }
    const res = await replaceRateRows(carparkId, rows);
    if (!res.ok) return res;
  }
  return { ok: true };
}
