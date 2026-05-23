// HDB carpark data from data.gov.sg. No API key required, CORS-friendly.
//
// Two datasets are involved:
//   1. HDB Carpark Information (CKAN datastore) — static metadata.
//      `car_park_no`, `address`, `x_coord` + `y_coord` (SVY21), `car_park_type`,
//      `short_term_parking`, `car_park_basement`, etc.
//   2. HDB Carpark Availability (v1 transport API) — live lot counts keyed
//      by `CarParkID` (matches `car_park_no`).

import { svy21ToWgs84 } from '../geo';

export type HdbCarparkInfo = {
  car_park_no: string;
  address: string;
  /** WGS84 lat (converted from SVY21 x_coord/y_coord) */
  lat: number;
  /** WGS84 lng */
  lng: number;
  car_park_type: string;
  type_of_parking_system: string;
  short_term_parking: string;
  free_parking: string;
  night_parking: string;
  car_park_decks: number;
  gantry_height: number;
  car_park_basement: string;
};

export type HdbAvailability = {
  car_park_no: string;
  total_lots: number;
  lots_available: number;
  /** Vehicle category: "C" car, "Y" motorcycle, "H" heavy */
  lot_type: string;
  updated: string;
};

const INFO_DATASET_ID = 'd_23f946fa557947f93a8043bbef41dd09';
const INFO_CACHE_KEY = 'psg.hdb.info.v3';
const INFO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InfoCacheRecord = {
  fetchedAt: number;
  data: HdbCarparkInfo[];
};

/** Fetch (and cache for 7 days) the static HDB carpark info dataset. */
export async function getHdbCarparkInfo(): Promise<HdbCarparkInfo[]> {
  try {
    const raw = localStorage.getItem(INFO_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as InfoCacheRecord;
      if (Date.now() - cached.fetchedAt < INFO_TTL_MS && cached.data?.length) {
        return cached.data;
      }
    }
  } catch {
    /* ignore */
  }

  const data = await fetchHdbCarparkInfo();
  try {
    localStorage.setItem(
      INFO_CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), data } satisfies InfoCacheRecord),
    );
  } catch {
    /* ignore quota errors */
  }
  return data;
}

async function fetchHdbCarparkInfo(): Promise<HdbCarparkInfo[]> {
  // data.gov.sg's CKAN datastore returns up to ~32k records per call.
  // ~2400 HDB carparks fit comfortably in a single page.
  const url = new URL('https://data.gov.sg/api/action/datastore_search');
  url.searchParams.set('resource_id', INFO_DATASET_ID);
  url.searchParams.set('limit', '10000');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HDB info fetch failed: ${res.status}`);
  const body = (await res.json()) as {
    success: boolean;
    result?: { records: RawInfoRecord[] };
  };
  if (!body.success || !body.result?.records) {
    throw new Error('HDB info response malformed');
  }
  return body.result.records.map(normalizeInfo).filter((c): c is HdbCarparkInfo => c != null);
}

type RawInfoRecord = {
  car_park_no: string;
  address: string;
  x_coord: string;
  y_coord: string;
  car_park_type: string;
  type_of_parking_system: string;
  short_term_parking: string;
  free_parking: string;
  night_parking: string;
  car_park_decks: string;
  gantry_height: string;
  car_park_basement: string;
};

function normalizeInfo(r: RawInfoRecord): HdbCarparkInfo | null {
  const x = parseFloat(r.x_coord);
  const y = parseFloat(r.y_coord);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const { lat, lng } = svy21ToWgs84(y, x);
  return {
    car_park_no: r.car_park_no.trim(),
    address: titleCase(r.address.trim()),
    lat,
    lng,
    car_park_type: r.car_park_type,
    type_of_parking_system: r.type_of_parking_system,
    short_term_parking: r.short_term_parking,
    free_parking: r.free_parking,
    night_parking: r.night_parking,
    car_park_decks: parseInt(r.car_park_decks, 10) || 0,
    gantry_height: parseFloat(r.gantry_height) || 0,
    car_park_basement: r.car_park_basement,
  };
}

const ALL_CAPS = /\b(HDB|URA|LTA|MSCP|MRT|SMRT|CBD|JEM|VIP|PIE|BKE|TPE|KPE|ECP|NSE|AYE|CTE|ICA|SAFRA|NTUC|NUS|NTU|SMU|SIM|HQ|NS|JCC|HQ|HCM)\b/gi;

// HDB addresses come in ALL CAPS. Title-case for display.
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .replace(ALL_CAPS, (m) => m.toUpperCase())
    .replace(/\bBlk\b/g, 'Blk');
}

/** Fetch the live lot counts. Returns a map keyed by car_park_no. */
export async function getHdbAvailability(): Promise<Map<string, HdbAvailability>> {
  const url = 'https://api.data.gov.sg/v1/transport/carpark-availability';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HDB availability fetch failed: ${res.status}`);
  const body = (await res.json()) as {
    items?: { carpark_data?: RawAvailability[] }[];
  };
  const items = body.items?.[0]?.carpark_data ?? [];
  const map = new Map<string, HdbAvailability>();
  for (const it of items) {
    // Pick the car-lot row (lot_type "C"). Some carparks list multiple rows.
    const carRow = it.carpark_info?.find((r) => r.lot_type === 'C');
    if (!carRow) continue;
    map.set(it.carpark_number, {
      car_park_no: it.carpark_number,
      total_lots: parseInt(carRow.total_lots, 10) || 0,
      lots_available: parseInt(carRow.lots_available, 10) || 0,
      lot_type: carRow.lot_type,
      updated: it.update_datetime,
    });
  }
  return map;
}

type RawAvailability = {
  carpark_number: string;
  update_datetime: string;
  carpark_info?: {
    total_lots: string;
    lot_type: string;
    lots_available: string;
  }[];
};
