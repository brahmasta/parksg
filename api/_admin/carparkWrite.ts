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
