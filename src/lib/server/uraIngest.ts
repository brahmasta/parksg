/**
 * Shared URA rate-ingest core. Imported by both the CLI
 * (scripts/ingest-ura-rates.ts) and the daily cron handler
 * (api/cron/ura-rates-ingest.ts).
 *
 * Flow: mint a 24h URA Token from the static AccessKey → fetch
 * Car_Park_Details → parse into structured RateRows (src/lib/ura.ts) →
 * write to the Supabase `rate_rows` table with source 'URA'.
 *
 * Idempotency: `rate_rows` has no unique constraint on
 * (carpark_id, day_type, start_time, end_time, veh_cat) — its only key is a
 * synthetic identity `id` — so a PostgREST onConflict upsert can't dedupe.
 * Instead we do a full refresh: delete every source='URA' row, then insert
 * the freshly parsed set. Re-runs converge to the same state, and bands URA
 * has dropped disappear rather than lingering. This mirrors the
 * delete-then-insert pattern in scripts/migrate-to-supabase.ts.
 *
 * Server-only: this module pulls in @supabase/supabase-js and is never
 * imported by client code (the browser reads PostgREST directly).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { parseUraRows } from '../ura';
import type { UraRawRow } from '../api/uraDetails';
import type { RateRow } from '../types';

const TOKEN_URL =
  'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1';
const DETAILS_URL =
  'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=Car_Park_Details';

const INSERT_CHUNK = 500;

type DbDayType = 'WEEKDAY' | 'SAT' | 'SUN_PH';
type DbParkingSystem = 'EPS' | 'COUPON' | 'GANTRY_PRIVATE' | 'FLAT';
type DbVehCat = 'CAR' | 'MOTORCYCLE' | 'HEAVY';

type DbRateRow = {
  carpark_id: string;
  day_type: DbDayType;
  start_time: string | null;
  end_time: string | null;
  per_block_cents: number;
  block_minutes: number;
  first_hour_cents: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: DbParkingSystem;
  veh_cat: DbVehCat;
  source: 'URA';
  effective_from: string;
};

export type IngestResult = {
  /** URA carparks (ppCodes) that contributed at least one rate row. */
  carparks: number;
  /** rate_rows inserted into Supabase. */
  upserted: number;
  /** Non-fatal problems (e.g. URA ppCodes with no matching carpark row). */
  errors: number;
};

export type IngestOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  accessKey: string;
  /** ISO timestamp stamped on every inserted row. Defaults to now. */
  effectiveFrom?: string;
  /** Optional progress sink (CLI uses stderr; cron stays silent). */
  log?: (msg: string) => void;
};

/** Mint a fresh 24h URA Data Service token from the static AccessKey. */
export async function mintUraToken(accessKey: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    headers: { AccessKey: accessKey, 'User-Agent': 'wheretopark.sg' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`URA token mint ${res.status}: ${body.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    Status?: string;
    Result?: string;
    Message?: string;
  };
  if (body.Status !== 'Success' || !body.Result) {
    throw new Error(
      `URA token mint failed: ${(body.Message ?? JSON.stringify(body)).slice(0, 200)}`,
    );
  }
  return body.Result;
}

/** Fetch the raw Car_Park_Details rows (one per rate band). */
export async function fetchUraDetailsRows(
  accessKey: string,
  token: string,
): Promise<UraRawRow[]> {
  const res = await fetch(DETAILS_URL, {
    headers: {
      AccessKey: accessKey,
      Token: token,
      'User-Agent': 'wheretopark.sg',
    },
  });
  if (!res.ok) throw new Error(`URA Car_Park_Details ${res.status}`);
  const body = (await res.json()) as {
    Status?: string;
    Result?: UraRawRow[];
    Message?: string;
  };
  if (body.Status !== 'Success' || !Array.isArray(body.Result)) {
    throw new Error(
      `URA Car_Park_Details: ${(body.Message ?? JSON.stringify(body)).slice(0, 200)}`,
    );
  }
  return body.Result;
}

function rateRowToDb(
  carparkId: string,
  rr: RateRow,
  effectiveFrom: string,
): DbRateRow | null {
  if (rr.perBlockCents == null || rr.blockMinutes == null) return null;
  return {
    carpark_id: carparkId,
    day_type: (rr.dayType ?? 'WEEKDAY') as DbDayType,
    start_time: rr.startTime ? `${rr.startTime}:00` : null,
    end_time: rr.endTime ? `${rr.endTime}:00` : null,
    per_block_cents: rr.perBlockCents,
    block_minutes: rr.blockMinutes,
    first_hour_cents: rr.firstHourCents ?? null,
    per_entry_cents: rr.perEntryCents ?? null,
    cap_cents: rr.capCents ?? null,
    grace_minutes: rr.graceMinutes ?? null,
    system: (rr.system as DbParkingSystem | undefined) ?? 'GANTRY_PRIVATE',
    veh_cat: (rr.vehCat as DbVehCat | undefined) ?? 'CAR',
    source: 'URA',
    effective_from: effectiveFrom,
  };
}

/**
 * Full URA rate refresh. Returns counts; throws only on fatal failures
 * (URA fetch error, or the bulk insert failing) so callers can surface a
 * 500 / non-zero exit.
 */
export async function ingestUraRates(opts: IngestOptions): Promise<IngestResult> {
  const log = opts.log ?? (() => {});
  const effectiveFrom = opts.effectiveFrom ?? new Date().toISOString();
  const supabase: SupabaseClient = createClient(
    opts.supabaseUrl,
    opts.serviceRoleKey,
    { auth: { persistSession: false } },
  );

  log('Minting URA token...');
  const token = await mintUraToken(opts.accessKey);

  log('Fetching Car_Park_Details...');
  const rawRows = await fetchUraDetailsRows(opts.accessKey, token);
  log(`  fetched ${rawRows.length} raw URA rows`);

  const grouped = parseUraRows(rawRows);
  log(`  parsed into ${grouped.size} URA carparks`);

  // The FK rate_rows.carpark_id → carparks.id means we can only insert rows
  // for carparks that already exist. Pull the URA spine once and skip any
  // ppCode URA returns that we haven't ingested into `carparks` yet.
  const existingIds = await fetchUraCarparkIds(supabase);

  const dbRows: DbRateRow[] = [];
  let carparks = 0;
  let errors = 0;

  for (const [ppCode, entry] of grouped.entries()) {
    const carparkId = `URA:${ppCode}`;
    if (!existingIds.has(carparkId)) {
      // URA knows this carpark but our spine doesn't — out of scope for the
      // rate ingest (carpark metadata sync is migrate-to-supabase's job).
      errors += 1;
      continue;
    }
    const before = dbRows.length;
    for (const rr of [...entry.weekday, ...entry.saturday, ...entry.sundayPH]) {
      const db = rateRowToDb(carparkId, rr, effectiveFrom);
      if (db) dbRows.push(db);
    }
    if (dbRows.length > before) carparks += 1;
  }

  // Safety: if a transient URA hiccup produced zero usable rows, don't wipe
  // the existing good data — bail before the destructive delete.
  if (dbRows.length === 0) {
    log('  no usable URA rate rows parsed — skipping write to avoid data loss');
    return { carparks: 0, upserted: 0, errors };
  }

  log(`  replacing source='URA' rate_rows with ${dbRows.length} fresh rows...`);
  const { error: delErr } = await supabase
    .from('rate_rows')
    .delete()
    .eq('source', 'URA');
  if (delErr) {
    throw new Error(`delete source='URA' rate_rows failed: ${delErr.message}`);
  }

  let upserted = 0;
  for (let i = 0; i < dbRows.length; i += INSERT_CHUNK) {
    const chunk = dbRows.slice(i, i + INSERT_CHUNK);
    const { error: insErr } = await supabase.from('rate_rows').insert(chunk);
    if (insErr) {
      throw new Error(`insert rate_rows chunk @${i} failed: ${insErr.message}`);
    }
    upserted += chunk.length;
  }

  log(`  inserted ${upserted} URA rate_rows across ${carparks} carparks (${errors} skipped)`);
  return { carparks, upserted, errors };
}

async function fetchUraCarparkIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('carparks')
      .select('id')
      .eq('agency', 'URA')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch URA carpark ids failed: ${error.message}`);
    const page = (data ?? []) as { id: string }[];
    for (const row of page) ids.add(row.id);
    if (page.length < PAGE) break;
  }
  return ids;
}
