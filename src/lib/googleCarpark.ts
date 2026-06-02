// Map a Google Places (New) nearby car park into a runtime Carpark, and dedup
// the Google set against our own DB carparks by spatial proximity.
//
// Google supplies no rates, capacity, or live availability, so the mapped
// carpark is flagged `rateUnknown` (cost renders "—") with null lots. These
// objects live in memory only and are never persisted (Google ToS).

import type { Carpark, DurationHours } from './types';
import { haversineMeters, walkMinutesFromMeters } from './geo';
import type { NearbyGooglePlace } from './api/googlePlaces';

/** Sentinel estimate — never displayed (every cost render site guards on
 * `rateUnknown`), but keeps `estByHours` non-optional for the rest of the app. */
const SENTINEL_EST: Record<DurationHours, number> = {
  0.5: 0,
  1: 0,
  1.5: 0,
  2: 0,
  3: 0,
  4: 0,
};

/** Distance under which a Google place is treated as the same carpark as one
 * already in our DB (so we don't double-list it). Mirrors the OSM coverage
 * audit's 60 m match radius. */
export const GOOGLE_DEDUP_M = 60;
/** Grid cell ≈ 66 m at the equator — one cell ≳ the dedup radius, so checking a
 * point's own cell plus its 8 neighbours is sufficient. */
const CELL_DEG = 0.0006;

export function googlePlaceToCarpark(
  p: NearbyGooglePlace,
  dest: { lat: number; lng: number },
): Carpark {
  const meters = haversineMeters(dest, { lat: p.lat, lng: p.lng });
  return {
    id: `google:${p.placeId}`,
    name: p.name,
    block: p.address,
    // 'LTA' only satisfies the Operator union; never rendered for a Google
    // carpark (CarparkCard/DetailScreen show a Google chip instead).
    operator: 'LTA',
    source: 'GOOGLE',
    rateUnknown: true,
    googleParking: p.parking,
    placeId: p.placeId,
    lotTypes: ['C'],
    lotsAvailable: null,
    lotsTotal: 0,
    walkMin: walkMinutesFromMeters(meters),
    walkMeters: Math.round(meters),
    grace: 0,
    coords: { entrance: [p.lat, p.lng] },
    rates: { weekday: [], saturday: [], sundayPH: [] },
    estByHours: { ...SENTINEL_EST },
  };
}

const cellKey = (lat: number, lng: number): string =>
  `${Math.floor(lat / CELL_DEG)},${Math.floor(lng / CELL_DEG)}`;

/**
 * Drop any Google carpark that sits within GOOGLE_DEDUP_M of an existing DB
 * carpark (we already have a better, verified record for it). Grid-indexed so
 * it's O(n) rather than O(google × db).
 */
export function filterNewGooglePlaces(
  googleCarparks: Carpark[],
  dbCarparks: Carpark[],
): Carpark[] {
  const grid = new Map<string, Carpark[]>();
  for (const cp of dbCarparks) {
    const [lat, lng] = cp.coords.entrance;
    const key = cellKey(lat, lng);
    const bucket = grid.get(key);
    if (bucket) bucket.push(cp);
    else grid.set(key, [cp]);
  }

  return googleCarparks.filter((g) => {
    const [gLat, gLng] = g.coords.entrance;
    const baseLat = Math.floor(gLat / CELL_DEG);
    const baseLng = Math.floor(gLng / CELL_DEG);
    for (let dLat = -1; dLat <= 1; dLat += 1) {
      for (let dLng = -1; dLng <= 1; dLng += 1) {
        const bucket = grid.get(`${baseLat + dLat},${baseLng + dLng}`);
        if (!bucket) continue;
        for (const db of bucket) {
          const [dbLat, dbLng] = db.coords.entrance;
          if (haversineMeters({ lat: gLat, lng: gLng }, { lat: dbLat, lng: dbLng }) <= GOOGLE_DEDUP_M) {
            return false; // already covered by a DB carpark
          }
        }
      }
    }
    return true;
  });
}
