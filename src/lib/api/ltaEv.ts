/**
 * Client wrapper for the /api/lta-ev-availability edge proxy.
 *
 * The proxy returns a flat list of normalised EV locations across SG;
 * the carpark spine join (haversine ≤50m) happens client-side so the
 * proxy can be cached across all searches and so the join rule can
 * evolve without a server roundtrip.
 */

import type { EVConnector } from '../types';

export type EvLocation = {
  name: string;
  address: string;
  postalCode: string;
  lat: number;
  lng: number;
  connectors: EVConnector[];
};

export type EvAvailabilityResponse = {
  /** "YYYY-MM-DD HH:mm:ss" from LTA — we treat any non-empty string as valid. */
  lastUpdatedTime: string;
  count: number;
  locations: EvLocation[];
};

const ENDPOINT = '/api/lta-ev-availability';

export async function fetchEvAvailability(
  signal?: AbortSignal,
): Promise<EvAvailabilityResponse | null> {
  const res = await fetch(ENDPOINT, { signal });
  if (!res.ok) return null;
  const body = (await res.json()) as
    | (EvAvailabilityResponse & { ok: true })
    | { ok: false; error?: string };
  if (!('ok' in body) || !body.ok) return null;
  return {
    lastUpdatedTime: body.lastUpdatedTime,
    count: body.count,
    locations: body.locations,
  };
}

/**
 * Minutes between "YYYY-MM-DD HH:mm:ss" (Singapore local) and now.
 * Returns null if the timestamp can't be parsed. The LTA dump omits a
 * timezone, but its content is always SGT — treat the string as +08:00.
 */
export function evSnapshotAgeMinutes(lastUpdatedTime: string): number | null {
  // Convert "2026-05-25 22:25:00" → "2026-05-25T22:25:00+08:00"
  const iso = lastUpdatedTime.replace(' ', 'T') + '+08:00';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60_000));
}
