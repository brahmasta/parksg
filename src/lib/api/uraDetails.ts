/**
 * Client wrapper for the /api/ura-carpark-details edge proxy.
 *
 * The proxy returns URA's raw Car_Park_Details rows (one row per rate
 * band). Normalisation into RateRows happens in src/lib/ura.ts so the
 * pure parser is independently testable.
 */

export type UraRawRow = {
  ppCode?: string;
  ppName?: string;
  weekdayRate?: string;
  weekdayMin?: string;
  satdayRate?: string;
  satdayMin?: string;
  sunPHRate?: string;
  sunPHMin?: string;
  startTime?: string;
  endTime?: string;
  /** "C" = Coupon, "B" = Electronic (EPS). */
  parkingSystem?: string;
  parkCapacity?: number;
  vehCat?: string;
  geometries?: unknown[];
};

export type UraDetailsResponse = {
  fetchedAt: string;
  count: number;
  items: UraRawRow[];
};

const ENDPOINT = '/api/ura-carpark-details';

export async function fetchUraDetails(
  signal?: AbortSignal,
): Promise<UraDetailsResponse | null> {
  const res = await fetch(ENDPOINT, { signal });
  if (!res.ok) return null;
  const body = (await res.json()) as
    | (UraDetailsResponse & { ok: true })
    | { ok: false; error?: string };
  if (!('ok' in body) || !body.ok) return null;
  return {
    fetchedAt: body.fetchedAt,
    count: body.count,
    items: body.items,
  };
}
