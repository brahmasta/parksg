// Which HDB carparks have motorcycle lots.
//
// HDB's live availability feed doesn't carry motorcycle ("Y") rows, so we
// fall back to the community "SG Motorcycle Parking" map (r/singapore, Dec
// 2022), itself derived from HDB's carpark list. Regenerate the JSON with
// scripts/extract-hdb-motorcycle.py.

import raw from './data/hdbMotorcycle.json';
import type { Carpark, RateRow } from './types';

type Entry = [lat: number, lng: number, address: string];

const MATCH_METERS = 40;
const CELL = 0.001; // ~110m grid cells

const byAddress = new Set<string>();
const grid = new Map<string, [number, number][]>();
for (const [lat, lng, addr] of raw as Entry[]) {
  byAddress.add(normalizeAddress(addr));
  const k = cellKey(lat, lng);
  const bucket = grid.get(k);
  if (bucket) bucket.push([lat, lng]);
  else grid.set(k, [[lat, lng]]);
}

function cellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / CELL)},${Math.floor(lng / CELL)}`;
}

function normalizeAddress(s: string): string {
  return s
    .toUpperCase()
    .replace(/\bBLOCK\b/g, 'BLK')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** True when an HDB carpark (by address or location) is known to have
 * motorcycle lots. */
export function hdbHasMotorcycleLots(lat: number, lng: number, address?: string | null): boolean {
  if (address && byAddress.has(normalizeAddress(address))) return true;
  const cy = Math.floor(lat / CELL);
  const cx = Math.floor(lng / CELL);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const [plat, plng] of grid.get(`${cy + dy},${cx + dx}`) ?? []) {
        const m = Math.hypot((plat - lat) * 110574, (plng - lng) * 111320);
        if (m <= MATCH_METERS) return true;
      }
    }
  }
  return false;
}

// HDB charges motorcycles one flat rate at every carpark: $0.65 per lot for
// the whole day (7am–10:30pm) and $0.65 for the whole night (10:30pm–7am),
// every day of the week. HDB doesn't publish it per carpark, so it's applied
// to any HDB carpark known to have motorcycle lots that has no rates of its own.
const HDB_MOTO_ROWS: RateRow[] = [
  { startTime: '07:00', endTime: '22:30', window: '7am – 10:30pm', rate: '$0.65 per lot, whole day', perEntryCents: 65, vehCat: 'MOTORCYCLE', source: 'HDB' },
  { startTime: '22:30', endTime: '07:00', window: '10:30pm – 7am', rate: '$0.65 per lot, whole night', perEntryCents: 65, vehCat: 'MOTORCYCLE', source: 'HDB' },
];

export const HDB_MOTORCYCLE_RATES: Carpark['rates'] = {
  weekday: HDB_MOTO_ROWS.map((r) => ({ ...r, dayType: 'WEEKDAY' })),
  saturday: HDB_MOTO_ROWS.map((r) => ({ ...r, dayType: 'SAT' })),
  sundayPH: HDB_MOTO_ROWS.map((r) => ({ ...r, dayType: 'SUN_PH' })),
};
