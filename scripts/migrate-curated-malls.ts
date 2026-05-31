/**
 * Curated mall ingest.
 *
 * Hand-curated, verified parking rates + coordinates for high-traffic private
 * carparks (malls / attractions). This is the accuracy fix for the long-stale
 * `LTA_DATAGOV` (Nov-2018) data: those rows had no coordinates (invisible on the
 * map) and outdated prices. Each entry here either:
 *   - REUSES an existing carpark id (e.g. "LTA:causeway_point") to update the
 *     2018 row in place — adds coords, replaces the stale rates; or
 *   - introduces a NEW carpark (id "OPERATOR:<slug>") for malls not yet in the DB.
 *
 * Everything written here is tagged `source = 'MANUAL'` so it is:
 *   - protected from the full-sync pipeline (see the MANUAL guards in
 *     scripts/migrate-to-supabase.ts), and
 *   - easy to identify / refresh later.
 *
 * Idempotent: re-running upserts the carpark and fully replaces its rate_rows
 * (delete-by-carpark_id, then insert), so re-runs are safe and also de-dup the
 * old data (e.g. the duplicate WEEKDAY rows the 2018 import left behind).
 *
 * Run: npm run migrate:malls
 *
 * Env (read from .env.local):
 *   SUPABASE_URL              required
 *   SUPABASE_SERVICE_ROLE_KEY required
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// ──────────────────────────────────────────────────────────────────────
// Curated JSON shape (camelCase, human-friendly) → DB rows.
// ──────────────────────────────────────────────────────────────────────

type DayType = 'WEEKDAY' | 'SAT' | 'SUN_PH';
type RateSystem = 'EPS' | 'COUPON' | 'GANTRY_PRIVATE' | 'FLAT';

type CuratedRate = {
  dayType: DayType;
  /** 'HH:mm'. Omit both start & end for an all-day rate. */
  start?: string | null;
  end?: string | null;
  /** First-hour (or first-block) flat charge, in cents. */
  firstHourCents?: number | null;
  /** Per-block charge after the first block, in cents. */
  perBlockCents?: number | null;
  blockMinutes?: number | null;
  /** Flat per-entry charge (e.g. some weekend/PH flat fees). */
  perEntryCents?: number | null;
  /** Daily cap, in cents. */
  capCents?: number | null;
  graceMinutes?: number | null;
  system?: RateSystem;
};

type CuratedMall = {
  /** Reuse an existing id ("LTA:..."), else derived as "OPERATOR:<slug>". */
  id?: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  operator?: string;
  totalLots?: number | null;
  provenance?: { url?: string; verified?: string };
  rates: CuratedRate[];
};

type Agency = 'HDB' | 'URA' | 'LTA' | 'JTC' | 'NPARKS' | 'OPERATOR';

type DbCarpark = {
  id: string;
  agency: Agency;
  source_code: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  car_park_type: string | null;
  parking_system: RateSystem;
  central_area: boolean;
  total_lots: number | null;
  source: 'MANUAL';
  last_synced: string;
  raw: unknown;
};

type DbRateRow = {
  carpark_id: string;
  day_type: DayType;
  start_time: string | null;
  end_time: string | null;
  per_block_cents: number;
  block_minutes: number;
  first_hour_cents: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: RateSystem;
  veh_cat: 'CAR';
  source: 'MANUAL';
  effective_from: string | null;
};

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function slugifyId(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** 'HH:mm' (or 'HH:mm:ss') → 'HH:mm:ss'; null/undefined/'24:00' → null. */
function timeToSql(t?: string | null): string | null {
  if (!t) return null;
  if (t === '24:00') return null; // treat "until midnight / all day" as open band
  const [h, m = '00'] = t.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
}

function carparkIdFor(entry: CuratedMall): string {
  if (entry.id && entry.id.trim()) return entry.id.trim();
  return `OPERATOR:${slugifyId(entry.name)}`;
}

function agencyFor(id: string): Agency {
  if (id.startsWith('LTA:')) return 'LTA';
  if (id.startsWith('HDB:')) return 'HDB';
  if (id.startsWith('URA:')) return 'URA';
  return 'OPERATOR';
}

function toDbCarpark(entry: CuratedMall, id: string, today: string): DbCarpark {
  return {
    id,
    agency: agencyFor(id),
    source_code: entry.name,
    name: entry.name,
    address: entry.address ?? null,
    lat: entry.lat,
    lng: entry.lng,
    car_park_type: 'MALL',
    parking_system: 'EPS',
    central_area: false,
    total_lots: entry.totalLots ?? null,
    source: 'MANUAL',
    last_synced: today,
    raw: { curated: true, operator: entry.operator ?? null, provenance: entry.provenance ?? null },
  };
}

function toDbRateRows(entry: CuratedMall, id: string): DbRateRow[] {
  const effective = entry.provenance?.verified
    ? `${entry.provenance.verified}-01`.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return entry.rates.map((r) => ({
    carpark_id: id,
    day_type: r.dayType,
    start_time: timeToSql(r.start),
    end_time: timeToSql(r.end),
    per_block_cents: r.perBlockCents ?? 0,
    block_minutes: r.blockMinutes ?? 0,
    first_hour_cents: r.firstHourCents ?? null,
    per_entry_cents: r.perEntryCents ?? null,
    cap_cents: r.capCents ?? null,
    grace_minutes: r.graceMinutes ?? null,
    system: r.system ?? 'EPS',
    veh_cat: 'CAR',
    source: 'MANUAL',
    effective_from: effective,
  }));
}

async function ingestOne(
  supabase: SupabaseClient,
  carpark: DbCarpark,
  rateRows: DbRateRow[],
): Promise<boolean> {
  const { error: upErr } = await supabase
    .from('carparks')
    .upsert(carpark, { onConflict: 'id' });
  if (upErr) {
    process.stderr.write(`  upsert carpark ${carpark.id} failed: ${upErr.message}\n`);
    return false;
  }
  // Replace rate_rows by carpark_id (NOT by source) so stale LTA_DATAGOV rows —
  // including the 2018 duplicates — are cleared regardless of their source.
  const { error: delErr } = await supabase
    .from('rate_rows')
    .delete()
    .eq('carpark_id', carpark.id);
  if (delErr) {
    process.stderr.write(`  delete rate_rows ${carpark.id} failed: ${delErr.message}\n`);
    return false;
  }
  if (rateRows.length === 0) return true;
  const { error: insErr } = await supabase.from('rate_rows').insert(rateRows);
  if (insErr) {
    process.stderr.write(`  insert rate_rows ${carpark.id} failed: ${insErr.message}\n`);
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const raw = readFileSync(resolve(__dirname, 'data/curated-malls.json'), 'utf8');
  const entries = JSON.parse(raw) as CuratedMall[];
  process.stderr.write(`Loaded ${entries.length} curated malls\n`);

  const today = new Date().toISOString();
  let okCarparks = 0;
  let okRows = 0;
  let errors = 0;
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!entry.name || !Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) {
      process.stderr.write(`  SKIP (missing name/lat/lng): ${entry.name ?? '?'}\n`);
      errors += 1;
      continue;
    }
    const id = carparkIdFor(entry);
    if (seen.has(id)) {
      process.stderr.write(`  SKIP (duplicate id ${id}): ${entry.name}\n`);
      errors += 1;
      continue;
    }
    seen.add(id);

    const carpark = toDbCarpark(entry, id, today);
    const rows = toDbRateRows(entry, id);
    const ok = await ingestOne(supabase, carpark, rows);
    if (ok) {
      okCarparks += 1;
      okRows += rows.length;
      process.stderr.write(`  ok ${id} (${rows.length} rate rows)\n`);
    } else {
      errors += 1;
    }
  }

  console.log('');
  console.log('=== Curated malls ingest ===');
  console.log(`Carparks upserted: ${okCarparks}`);
  console.log(`Rate rows written: ${okRows}`);
  console.log(`Errors:            ${errors}`);
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
