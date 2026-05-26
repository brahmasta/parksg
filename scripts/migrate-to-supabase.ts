/**
 * One-time migration script: populates the `carparks` and `rate_rows`
 * Supabase tables from three Singapore government sources.
 *
 * Sources, in priority order:
 *   1. HDB Carpark Information (data.gov.sg) — metadata + inferred rates
 *   2. URA Car_Park_Details (URA Data Service) — metadata + real rate bands
 *   3. LTA Carpark Rates (data.gov.sg, 2018 snapshot) — mall/hotel rates
 *
 * Each source is wrapped in its own try/catch: one failing source must not
 * abort the others. Final stdout summary lists carparks + rate_rows + errors
 * per source.
 *
 * Run: npx tsx scripts/migrate-to-supabase.ts
 *
 * Env (read from .env.local in the project root):
 *   SUPABASE_URL              required
 *   SUPABASE_SERVICE_ROLE_KEY required
 *   URA_ACCESS_KEY            optional (URA source skipped if missing)
 */

import 'dotenv/config';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { svy21ToWgs84 } from '../src/lib/geo';
import { parseUraRows } from '../src/lib/ura';
import type { UraRawRow } from '../src/lib/api/uraDetails';
import { parseDayRate } from './lib/parse-lta-rate';
import type { RateRow } from '../src/lib/types';

// Load .env.local explicitly (in addition to the root .env that dotenv/config picks up).
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// ──────────────────────────────────────────────────────────────────────
// Types matching the Supabase tables
// ──────────────────────────────────────────────────────────────────────

type Agency = 'HDB' | 'URA' | 'LTA' | 'JTC' | 'NPARKS' | 'OPERATOR';
type ParkingSystem = 'EPS' | 'COUPON' | 'GANTRY_PRIVATE' | 'FLAT';
type DayType = 'WEEKDAY' | 'SAT' | 'SUN_PH';
type VehCat = 'CAR' | 'MOTORCYCLE' | 'HEAVY';
type Source =
  | 'URA'
  | 'HDB'
  | 'LTA_DATAGOV'
  | 'LTA_DATAMALL'
  | 'CAG'
  | 'OPERATOR'
  | 'MANUAL';

type DbCarpark = {
  id: string;
  agency: Agency;
  source_code: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  car_park_type: string | null;
  parking_system: ParkingSystem;
  central_area: boolean;
  total_lots: number | null;
  source: Source;
  last_synced: string;
  raw: unknown;
};

type DbRateRow = {
  carpark_id: string;
  day_type: DayType;
  start_time: string | null; // 'HH:mm:ss'
  end_time: string | null;
  per_block_cents: number;
  block_minutes: number;
  first_hour_cents: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: ParkingSystem;
  veh_cat: VehCat;
  source: Source;
  effective_from: string | null; // 'YYYY-MM-DD'
};

// ──────────────────────────────────────────────────────────────────────
// Tiny concurrency limiter — avoids a p-limit dep
// ──────────────────────────────────────────────────────────────────────

function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active -= 1;
    const fn = queue.shift();
    if (fn) fn();
  };
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise((res, rej) => {
      const run = () => {
        active += 1;
        task().then(
          (v) => {
            res(v);
            next();
          },
          (e) => {
            rej(e);
            next();
          },
        );
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
}

// ──────────────────────────────────────────────────────────────────────
// SVY21 → WGS84
//
// The spec called for OneMap's convert endpoint, but it now requires a
// Bearer token (a probe of /api/common/convert/3414to4326 returned
// "Unauthorized"). The project already ships a local svy21ToWgs84 in
// src/lib/geo.ts implementing the same SLA SVY21 → WGS84 spec, so we
// use that — same math, deterministic, no network, no rate limit, no
// auth. Cache keyed by rounded (x,y) so duplicate carpark coordinates
// (rare but possible) only compute once.
// ──────────────────────────────────────────────────────────────────────

const coordCache = new Map<string, { lat: number; lng: number }>();

function convertSvy21(
  x: number,
  y: number,
): { lat: number; lng: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const key = `${x.toFixed(4)},${y.toFixed(4)}`;
  const hit = coordCache.get(key);
  if (hit) return hit;
  const local = svy21ToWgs84(y, x); // (northing, easting)
  coordCache.set(key, local);
  return local;
}

// ──────────────────────────────────────────────────────────────────────
// Result-tracking
// ──────────────────────────────────────────────────────────────────────

type SourceResult = { carparks: number; rateRows: number; errors: number };

function makeResult(): SourceResult {
  return { carparks: 0, rateRows: 0, errors: 0 };
}

// ──────────────────────────────────────────────────────────────────────
// HDB
// ──────────────────────────────────────────────────────────────────────

const HDB_DATASET_ID = 'd_23f946fa557947f93a8043bbef41dd09';
// Carparks whose car_park_no prefix indicates Central Business District
// pricing tier (per spec).
const CENTRAL_PREFIXES = [
  'ACB', 'BBB', 'BRB', 'CY', 'DCB', 'DCM', 'ESB', 'HBB', 'HLM', 'KAB',
  'KAM', 'KAS', 'MP14', 'SE21', 'SE22', 'SK1', 'SK2', 'SK4', 'SK5', 'SK6',
  'SK7', 'SR1', 'SR2', 'TPM', 'TP1', 'UCS', 'WCB',
];

type HdbRecord = {
  car_park_no?: string;
  address?: string;
  x_coord?: number | string;
  y_coord?: number | string;
  car_park_type?: string;
  type_of_parking_system?: string;
  short_term_parking?: string;
  free_parking?: string;
  night_parking?: string;
  car_park_decks?: number | string;
  gantry_height?: number | string;
  car_park_basement?: string;
};

function isCentralArea(carParkNo: string): boolean {
  const up = carParkNo.toUpperCase();
  return CENTRAL_PREFIXES.some((p) => up.startsWith(p));
}

function hdbParkingSystem(s: string | undefined): ParkingSystem {
  const v = (s ?? '').toUpperCase();
  if (v.includes('ELECTRONIC')) return 'EPS';
  if (v.includes('COUPON')) return 'COUPON';
  return 'EPS';
}

function inferHdbRateRows(carParkId: string, central: boolean, system: ParkingSystem): DbRateRow[] {
  const perBlockCents = central ? 120 : 60;
  const capCents = central ? 2000 : 1200;
  const today = new Date().toISOString().slice(0, 10);
  const dayTypes: DayType[] = ['WEEKDAY', 'SAT', 'SUN_PH'];
  return dayTypes.map((day) => ({
    carpark_id: carParkId,
    day_type: day,
    start_time: '07:00:00',
    end_time: '22:30:00',
    per_block_cents: perBlockCents,
    block_minutes: 30,
    first_hour_cents: null,
    per_entry_cents: null,
    cap_cents: capCents,
    grace_minutes: 15,
    system,
    veh_cat: 'CAR',
    source: 'HDB',
    effective_from: today,
  }));
}

async function fetchHdbRecords(): Promise<HdbRecord[]> {
  // data.gov.sg's CKAN datastore returns 429 to back-to-back paginated
  // calls for this dataset. The single big-limit fetch that the rest of
  // the app uses (src/lib/api/hdb.ts) sails through fine — match it.
  const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${HDB_DATASET_ID}&limit=10000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HDB datastore ${res.status}`);
  const body = (await res.json()) as { result?: { records?: HdbRecord[] } };
  return body.result?.records ?? [];
}

async function migrateHdb(supabase: SupabaseClient): Promise<SourceResult> {
  const result = makeResult();
  process.stderr.write('\n== HDB ==\n');
  const records = await fetchHdbRecords();
  process.stderr.write(`  fetched ${records.length} HDB records\n`);

  const today = new Date().toISOString();
  const carparks: DbCarpark[] = [];
  const rateRowsByCp = new Map<string, DbRateRow[]>();

  for (const r of records) {
    const carParkNo = (r.car_park_no ?? '').trim();
    if (!carParkNo) {
      result.errors += 1;
      continue;
    }
    const x = typeof r.x_coord === 'string' ? parseFloat(r.x_coord) : r.x_coord;
    const y = typeof r.y_coord === 'string' ? parseFloat(r.y_coord) : r.y_coord;
    const coords =
      typeof x === 'number' && typeof y === 'number'
        ? convertSvy21(x, y)
        : null;
    const central = isCentralArea(carParkNo);
    const parkingSystem = hdbParkingSystem(r.type_of_parking_system);
    const carparkId = `HDB:${carParkNo}`;

    carparks.push({
      id: carparkId,
      agency: 'HDB',
      source_code: carParkNo,
      name: titleCase(r.address ?? carParkNo),
      address: r.address ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      car_park_type: r.car_park_type ?? null,
      parking_system: parkingSystem,
      central_area: central,
      total_lots: null,
      source: 'HDB',
      last_synced: today,
      raw: r,
    });
    rateRowsByCp.set(carparkId, inferHdbRateRows(carparkId, central, parkingSystem));
  }

  // Batched carpark upsert.
  const chunkSize = 500;
  for (let i = 0; i < carparks.length; i += chunkSize) {
    const chunk = carparks.slice(i, i + chunkSize);
    const { error } = await supabase.from('carparks').upsert(chunk, { onConflict: 'id' });
    if (error) {
      process.stderr.write(`  HDB carpark upsert (chunk ${i}-${i + chunk.length}) failed: ${error.message}\n`);
      result.errors += chunk.length;
    } else {
      result.carparks += chunk.length;
      process.stderr.write(`  upserted ${result.carparks}/${carparks.length} HDB carparks\n`);
    }
  }

  // Wipe-and-reinsert rate_rows in batches keyed by carpark_id list.
  const allIds = Array.from(rateRowsByCp.keys());
  for (let i = 0; i < allIds.length; i += chunkSize) {
    const idChunk = allIds.slice(i, i + chunkSize);
    const { error: delErr } = await supabase
      .from('rate_rows')
      .delete()
      .in('carpark_id', idChunk);
    if (delErr) {
      process.stderr.write(`  HDB rate_rows delete (chunk ${i}) failed: ${delErr.message}\n`);
      continue;
    }
  }
  const allRows = Array.from(rateRowsByCp.values()).flat();
  for (let i = 0; i < allRows.length; i += chunkSize) {
    const chunk = allRows.slice(i, i + chunkSize);
    const { error } = await supabase.from('rate_rows').insert(chunk);
    if (error) {
      process.stderr.write(`  HDB rate_rows insert (chunk ${i}) failed: ${error.message}\n`);
      result.errors += chunk.length;
    } else {
      result.rateRows += chunk.length;
    }
  }
  process.stderr.write(`  inserted ${result.rateRows} HDB rate_rows\n`);
  return result;
}

// ──────────────────────────────────────────────────────────────────────
// URA
// ──────────────────────────────────────────────────────────────────────

async function mintUraToken(accessKey: string): Promise<string> {
  const res = await fetch(
    'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1',
    { headers: { AccessKey: accessKey, 'User-Agent': 'wheretopark.sg' } },
  );
  if (!res.ok) throw new Error(`URA token mint ${res.status}`);
  const body = (await res.json()) as { Status?: string; Result?: string; Message?: string };
  if (body.Status !== 'Success' || !body.Result) {
    throw new Error(`URA token mint failed: ${body.Message ?? JSON.stringify(body)}`);
  }
  return body.Result;
}

async function fetchUraDetailsRows(accessKey: string): Promise<UraRawRow[]> {
  const token = await mintUraToken(accessKey);
  const res = await fetch(
    'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=Car_Park_Details',
    {
      headers: {
        AccessKey: accessKey,
        Token: token,
        'User-Agent': 'wheretopark.sg',
      },
    },
  );
  if (!res.ok) throw new Error(`URA details ${res.status}`);
  const body = (await res.json()) as {
    Status?: string;
    Result?: UraRawRow[];
    Message?: string;
  };
  if (body.Status !== 'Success' || !Array.isArray(body.Result)) {
    throw new Error(`URA details: ${body.Message ?? JSON.stringify(body)}`);
  }
  return body.Result;
}

function uraGeometryToSvy21(
  geometries: unknown[] | undefined,
): { x: number; y: number } | null {
  const first = geometries?.[0] as { coordinates?: string } | undefined;
  const coords = first?.coordinates;
  if (!coords) return null;
  const [xStr, yStr] = coords.split(',');
  const x = parseFloat(xStr);
  const y = parseFloat(yStr);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function rateRowToDb(
  carparkId: string,
  rr: RateRow,
  fallbackSource: Source,
  defaultSystem: ParkingSystem,
): DbRateRow | null {
  // Skip free / placeholder rows that have no per-block pricing.
  if (rr.perBlockCents == null) return null;
  if (rr.blockMinutes == null) return null;
  const day = (rr.dayType ?? 'WEEKDAY') as DayType;
  return {
    carpark_id: carparkId,
    day_type: day,
    start_time: rr.startTime ? `${rr.startTime}:00` : null,
    end_time: rr.endTime ? `${rr.endTime}:00` : null,
    per_block_cents: rr.perBlockCents,
    block_minutes: rr.blockMinutes,
    first_hour_cents: rr.firstHourCents ?? null,
    per_entry_cents: rr.perEntryCents ?? null,
    cap_cents: rr.capCents ?? null,
    grace_minutes: rr.graceMinutes ?? null,
    system: (rr.system as ParkingSystem | undefined) ?? defaultSystem,
    veh_cat: (rr.vehCat as VehCat | undefined) ?? 'CAR',
    source: (rr.source as Source | undefined) ?? fallbackSource,
    effective_from: rr.effectiveFrom ?? null,
  };
}

async function migrateUra(
  supabase: SupabaseClient,
  accessKey: string,
): Promise<SourceResult> {
  const result = makeResult();
  process.stderr.write('\n== URA ==\n');
  const rows = await fetchUraDetailsRows(accessKey);
  process.stderr.write(`  fetched ${rows.length} URA raw rows\n`);
  const grouped = parseUraRows(rows);
  process.stderr.write(`  parsed into ${grouped.size} unique URA carparks\n`);

  // Raw rows keyed by ppCode for SVY21 lookup (parser drops geometries).
  const rawByPp = new Map<string, UraRawRow>();
  for (const raw of rows) {
    const code = (raw.ppCode ?? '').trim();
    if (code && !rawByPp.has(code)) rawByPp.set(code, raw);
  }

  const today = new Date().toISOString();
  for (const [ppCode, entry] of grouped.entries()) {
    const raw = rawByPp.get(ppCode);
    const svy = uraGeometryToSvy21(raw?.geometries);
    const coords = svy ? convertSvy21(svy.x, svy.y) : null;
    const carparkId = `URA:${ppCode}`;

    const carpark: DbCarpark = {
      id: carparkId,
      agency: 'URA',
      source_code: ppCode,
      name: entry.ppName,
      address: null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      car_park_type: raw?.vehCat ?? null,
      parking_system: 'GANTRY_PRIVATE',
      central_area: false,
      total_lots: entry.parkCapacity > 0 ? entry.parkCapacity : null,
      source: 'URA',
      last_synced: today,
      raw: raw ?? null,
    };

    const dbRows: DbRateRow[] = [];
    for (const rr of [...entry.weekday, ...entry.saturday, ...entry.sundayPH]) {
      const db = rateRowToDb(carparkId, rr, 'URA', 'GANTRY_PRIVATE');
      if (db) dbRows.push(db);
    }
    const ok = await upsertCarparkWithRates(supabase, carpark, dbRows);
    if (ok) {
      result.carparks += 1;
      result.rateRows += dbRows.length;
    } else {
      result.errors += 1;
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────
// LTA 2018 CSV (data.gov.sg)
// ──────────────────────────────────────────────────────────────────────

const LTA_RATES_DATASET = 'd_9f6056bdb6b1dfba57f063593e4f34ae';

type LtaCsvRecord = {
  carpark?: string;
  category?: string;
  weekdays_rate_1?: string;
  weekdays_rate_2?: string;
  saturday_rate?: string;
  sunday_publicholiday_rate?: string;
};

async function fetchLtaCsvRecords(): Promise<LtaCsvRecord[]> {
  const out: LtaCsvRecord[] = [];
  let offset = 0;
  for (;;) {
    const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${LTA_RATES_DATASET}&limit=500&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`LTA CSV datastore ${res.status}`);
    const body = (await res.json()) as {
      result?: { records?: LtaCsvRecord[]; total?: number };
    };
    const records = body.result?.records ?? [];
    if (records.length === 0) break;
    out.push(...records);
    offset += records.length;
    if (typeof body.result?.total === 'number' && offset >= body.result.total) break;
    if (offset > 5_000) break; // safety cap
  }
  return out;
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9@ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

async function migrateLtaCsv(
  supabase: SupabaseClient,
  existingNamesById: Map<string, string>,
): Promise<SourceResult> {
  const result = makeResult();
  process.stderr.write('\n== LTA Carpark Rates (2018 CSV) ==\n');
  const records = await fetchLtaCsvRecords();
  process.stderr.write(`  fetched ${records.length} CSV rows\n`);

  // Build name → existing carpark id lookup for matching.
  const existingByName = new Map<string, string>();
  for (const [id, n] of existingNamesById.entries()) {
    existingByName.set(normaliseName(n), id);
  }

  const today = new Date().toISOString();
  for (const r of records) {
    const name = (r.carpark ?? '').trim();
    if (!name) {
      result.errors += 1;
      continue;
    }
    const normKey = normaliseName(name);

    // Try to match an existing carpark by normalised name; otherwise insert
    // a new LTA-agency carpark with no coords (CSV has none).
    const matchedId = existingByName.get(normKey);
    const carparkId = matchedId ?? `LTA:${slugifyId(name)}`;

    // Parse each day-type rate; collect any unparseable strings for the raw note.
    const dbRows: DbRateRow[] = [];
    const parseNotes: Record<string, string> = {};
    const dayColumns: [keyof LtaCsvRecord, DayType][] = [
      ['weekdays_rate_1', 'WEEKDAY'],
      ['weekdays_rate_2', 'WEEKDAY'],
      ['saturday_rate', 'SAT'],
      ['sunday_publicholiday_rate', 'SUN_PH'],
    ];
    for (const [col, dayType] of dayColumns) {
      const raw = (r[col] as string | undefined) ?? '';
      if (!raw.trim()) continue;
      const parsed = parseDayRate(raw);
      if (!parsed.ok) {
        parseNotes[col] = `${parsed.reason} :: ${raw}`;
        // Per spec: store an unparseable rate as per_block_cents=0 so the
        // carpark still exists in rate_rows for visibility.
        dbRows.push({
          carpark_id: carparkId,
          day_type: dayType,
          start_time: null,
          end_time: null,
          per_block_cents: 0,
          block_minutes: 0,
          first_hour_cents: null,
          per_entry_cents: null,
          cap_cents: null,
          grace_minutes: null,
          system: 'FLAT',
          veh_cat: 'CAR',
          source: 'LTA_DATAGOV',
          effective_from: '2018-11-01',
        });
        continue;
      }
      for (const rr of parsed.rows) {
        rr.dayType = dayType;
        const db = rateRowToDb(carparkId, rr, 'LTA_DATAGOV', 'FLAT');
        if (db) {
          db.effective_from = '2018-11-01';
          dbRows.push(db);
        }
      }
    }

    // If we matched an existing HDB or URA carpark, SKIP. HDB has live-rule
    // inferred rates and URA has live Data Service bands — both beat the
    // 2018 CSV snapshot. Only attach LTA rate_rows when the match is itself
    // another LTA-prefixed carpark (rare: a same-name LTA CSV row re-import).
    if (matchedId) {
      if (matchedId.startsWith('LTA:')) {
        const ok = await replaceRateRows(supabase, matchedId, dbRows);
        if (ok) result.rateRows += dbRows.length;
        else result.errors += 1;
      }
      // Else: leave HDB/URA rates intact, don't touch.
      continue;
    }

    const carpark: DbCarpark = {
      id: carparkId,
      agency: 'LTA',
      source_code: name,
      name,
      address: null,
      lat: null,
      lng: null,
      car_park_type: r.category ?? null,
      parking_system: 'FLAT',
      central_area: false,
      total_lots: null,
      source: 'LTA_DATAGOV',
      last_synced: today,
      raw: { record: r, parseNotes },
    };
    const ok = await upsertCarparkWithRates(supabase, carpark, dbRows);
    if (ok) {
      result.carparks += 1;
      result.rateRows += dbRows.length;
    } else {
      result.errors += 1;
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────
// Supabase plumbing
// ──────────────────────────────────────────────────────────────────────

async function upsertCarparkWithRates(
  supabase: SupabaseClient,
  carpark: DbCarpark,
  rateRows: DbRateRow[],
): Promise<boolean> {
  const { error: upsertErr } = await supabase
    .from('carparks')
    .upsert(carpark, { onConflict: 'id' });
  if (upsertErr) {
    process.stderr.write(
      `  upsert carpark ${carpark.id} failed: ${upsertErr.message}\n`,
    );
    return false;
  }
  return replaceRateRows(supabase, carpark.id, rateRows);
}

async function replaceRateRows(
  supabase: SupabaseClient,
  carparkId: string,
  rateRows: DbRateRow[],
): Promise<boolean> {
  const { error: delErr } = await supabase
    .from('rate_rows')
    .delete()
    .eq('carpark_id', carparkId);
  if (delErr) {
    process.stderr.write(
      `  delete rate_rows for ${carparkId} failed: ${delErr.message}\n`,
    );
    return false;
  }
  if (rateRows.length === 0) return true;
  const { error: insErr } = await supabase.from('rate_rows').insert(rateRows);
  if (insErr) {
    process.stderr.write(
      `  insert rate_rows for ${carparkId} failed: ${insErr.message}\n`,
    );
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────────
// Misc
// ──────────────────────────────────────────────────────────────────────

const ALL_CAPS = /\b(?:HDB|URA|LTA|MSCP|MRT|SMRT|CBD|JEM|VIP|PIE|BKE|TPE|KPE|ECP|NSE|AYE|CTE|ICA|SAFRA|NTUC|NUS|NTU|SMU|SIM|MBS|YTL|SP|EV|AC|DC|JLN|BLK)\b/gi;
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(ALL_CAPS, (m) => m.toUpperCase());
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local',
    );
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const hdb = makeResult();
  const ura = makeResult();
  const lta = makeResult();

  // HDB first — fills the spine.
  try {
    Object.assign(hdb, await migrateHdb(supabase));
  } catch (err) {
    hdb.errors += 1;
    process.stderr.write(`HDB failed: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // URA — skip if no key.
  const uraKey = process.env.URA_ACCESS_KEY;
  if (!uraKey) {
    process.stderr.write('\n== URA == (skipped — URA_ACCESS_KEY not set)\n');
  } else {
    try {
      Object.assign(ura, await migrateUra(supabase, uraKey));
    } catch (err) {
      ura.errors += 1;
      process.stderr.write(`URA failed: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  // LTA CSV — needs the existing names already in the DB for matching.
  try {
    const existing = await loadExistingCarparkNames(supabase);
    Object.assign(lta, await migrateLtaCsv(supabase, existing));
    // Self-heal: an earlier failed run may have inserted LTA-prefixed
    // carparks for names that now belong to an HDB/URA carpark. Sweep
    // them up so the second source's rates aren't shadowed by a stale
    // duplicate row.
    const orphans = await deleteShadowedLtaOrphans(supabase);
    if (orphans > 0) {
      process.stderr.write(`  cleaned ${orphans} LTA orphans shadowed by HDB/URA\n`);
    }
  } catch (err) {
    lta.errors += 1;
    process.stderr.write(`LTA CSV failed: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // Summary
  const fmt = (n: number) => String(n).padStart(7);
  console.log('');
  console.log('=== Migration summary ===');
  console.log('source       | carparks | rate_rows | errors');
  console.log('-------------+----------+-----------+-------');
  console.log(`HDB          |${fmt(hdb.carparks)}  |${fmt(hdb.rateRows)}   |${fmt(hdb.errors)}`);
  console.log(`URA          |${fmt(ura.carparks)}  |${fmt(ura.rateRows)}   |${fmt(ura.errors)}`);
  console.log(`LTA_DATAGOV  |${fmt(lta.carparks)}  |${fmt(lta.rateRows)}   |${fmt(lta.errors)}`);
  console.log('');
  console.log(`Unique SVY21 coords converted (local svy21ToWgs84): ${coordCache.size}`);
}

async function deleteShadowedLtaOrphans(
  supabase: SupabaseClient,
): Promise<number> {
  const all = await loadExistingCarparkIds(supabase);
  const hdbUraByName = new Map<string, string>();
  for (const row of all) {
    if (row.id.startsWith('HDB:') || row.id.startsWith('URA:')) {
      hdbUraByName.set(normaliseName(row.name), row.id);
    }
  }
  const toDelete: string[] = [];
  for (const row of all) {
    if (!row.id.startsWith('LTA:')) continue;
    const match = hdbUraByName.get(normaliseName(row.name));
    if (match) toDelete.push(row.id);
  }
  if (toDelete.length === 0) return 0;
  // rate_rows must go first (FK).
  await supabase.from('rate_rows').delete().in('carpark_id', toDelete);
  const { error } = await supabase.from('carparks').delete().in('id', toDelete);
  if (error) {
    process.stderr.write(`  orphan cleanup failed: ${error.message}\n`);
    return 0;
  }
  return toDelete.length;
}

async function loadExistingCarparkIds(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('carparks')
      .select('id, name')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`load carpark ids: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as Array<{ id: string; name: string }>));
    if (data.length < pageSize) break;
  }
  return out;
}

async function loadExistingCarparkNames(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('carparks')
      .select('id, name')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`load carparks: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ id: string; name: string }>) {
      out.set(row.id, row.name ?? '');
    }
    if (data.length < pageSize) break;
  }
  return out;
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
