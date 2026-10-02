/**
 * Geocode the LTA_DATAGOV long tail — the Nov-2018 data.gov.sg "Carpark Rates"
 * rows that have no coordinates and so never appear in a search.
 *
 * Reads the current LTA_DATAGOV standalones from the DB (read-only, anon key),
 * matches each name to a OneMap building, and prints a review report: what was
 * matched (and how), what was skipped (and why), and what is left unmatched.
 * With --write it saves the matches to scripts/data/lta-datagov-coords.json,
 * which `migrateLtaCsv` (scripts/migrate-to-supabase.ts) reads on every sync.
 * The rules live in scripts/lib/lta-datagov-geo.ts; hand decisions go in its
 * REVIEWED table.
 *
 * Building sources, in order:
 *   1. The Open-Data-Licensed OneMap postal-code dump (2017 snapshot, ~57 MB),
 *      https://github.com/xkjyeah/singapore-postal-codes — downloaded to
 *      scripts/out/ on first run, or pass --buildings <path>.
 *   2. The OneMap search API, for names the dump doesn't know (skip: --no-search).
 *
 * Usage:
 *   npm run geocode:lta-datagov              # dry run — report only
 *   npm run geocode:lta-datagov -- --write   # also write the coords JSON
 *
 * Env (.env.local): SUPABASE_URL or VITE_SUPABASE_URL, and VITE_SUPABASE_ANON_KEY.
 */

import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  buildingFromOneMap,
  coordsFileFrom,
  indexBuildings,
  nameVariants,
  planCoords,
  reviewAliases,
  type Building,
  type BuildingSource,
  type DbRateRowLike,
  type LtaDataGovRow,
  type OneMapRecord,
  type PlacedCarpark,
  type PlanOutcome,
} from './lib/lta-datagov-geo';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const BUILDINGS_URL =
  'https://raw.githubusercontent.com/xkjyeah/singapore-postal-codes/master/buildings.json';
const DEFAULT_BUILDINGS = resolve(__dirname, 'out/onemap-buildings-2017.json');
const COORDS_PATH = resolve(__dirname, 'data/lta-datagov-coords.json');
const REPORT_PATH = resolve(__dirname, 'out/lta-datagov-geocode.md');
const SEARCH_CACHE_PATH = resolve(__dirname, 'out/onemap-search-cache.json');
const CURATED_PATH = resolve(__dirname, 'data/curated-malls.json');
const ONEMAP_SEARCH = 'https://www.onemap.gov.sg/api/common/elastic/search';

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

// ──────────────────────────────────────────────────────────────────────
// Inputs
// ──────────────────────────────────────────────────────────────────────

async function pageAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return out;
}

async function loadLtaDataGovRows(supabase: SupabaseClient): Promise<LtaDataGovRow[]> {
  type Raw = {
    id: string;
    name: string;
    raw: { record?: Record<string, string | undefined> } | null;
    rate_rows: DbRateRowLike[];
  };
  const RATE_COLUMNS = ['weekdays_rate_1', 'weekdays_rate_2', 'saturday_rate', 'sunday_publicholiday_rate'];
  const rows = await pageAll<Raw>((from, to) =>
    supabase
      .from('carparks')
      .select('id, name, raw, rate_rows(per_block_cents, block_minutes, first_hour_cents, per_entry_cents)')
      .eq('source', 'LTA_DATAGOV')
      .order('id')
      .range(from, to),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.raw?.record?.category ?? null,
    rateRows: r.rate_rows ?? [],
    rateText: RATE_COLUMNS.map((c) => r.raw?.record?.[c] ?? '').join(' | '),
  }));
}

async function loadPlaced(supabase: SupabaseClient): Promise<PlacedCarpark[]> {
  const fromDb = await pageAll<PlacedCarpark>((from, to) =>
    supabase
      .from('carparks')
      .select('id, name, lat, lng')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('id')
      .range(from, to),
  );
  // Curated entries count even before `npm run migrate:malls` reaches the DB,
  // and their names count as aliases: rates-only entries keep the DataMall name
  // on the DB row ("Bt Panjang Plaza", "Millenia Singapore"), which the CSV's
  // "Bukit Panjang Plaza" / "Millenia Walk" wouldn't otherwise match.
  const byId = new Map(fromDb.map((c) => [c.id, c]));
  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8')) as Array<{
    id?: string;
    name: string;
    lat?: number | null;
    lng?: number | null;
  }>;
  const out = [...fromDb];
  for (const c of curated) {
    const id = c.id ?? `OPERATOR:${c.name}`;
    const db = byId.get(id);
    const lat = db?.lat ?? c.lat;
    const lng = db?.lng ?? c.lng;
    if (lat && lng && db?.name !== c.name) out.push({ id, name: c.name, lat, lng });
  }
  return out;
}

async function loadProtectedIds(supabase: SupabaseClient): Promise<Set<string>> {
  const rows = await pageAll<{ carpark_id: string }>((from, to) =>
    supabase.from('rate_rows').select('carpark_id').eq('source', 'MANUAL').range(from, to),
  );
  return new Set(rows.map((r) => r.carpark_id));
}

async function loadDumpBuildings(path: string): Promise<Building[]> {
  if (!existsSync(path)) {
    process.stderr.write(`Downloading the OneMap postal-code dump (~57 MB) to ${path}…\n`);
    const res = await fetch(BUILDINGS_URL);
    if (!res.ok) throw new Error(`buildings.json download: HTTP ${res.status}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const records = JSON.parse(readFileSync(path, 'utf8')) as OneMapRecord[];
  return records.map(buildingFromOneMap).filter((b): b is Building => b !== null);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Raw search results by query, so re-runs while reviewing don't re-hit OneMap.
 * Delete the file to refresh. */
function loadSearchCache(): Record<string, OneMapRecord[]> {
  return existsSync(SEARCH_CACHE_PATH)
    ? (JSON.parse(readFileSync(SEARCH_CACHE_PATH, 'utf8')) as Record<string, OneMapRecord[]>)
    : {};
}

async function searchOneMap(names: string[]): Promise<Building[]> {
  const cache = loadSearchCache();
  const out: Building[] = [];
  const keep = (records: OneMapRecord[]) => {
    for (const r of records) {
      const b = buildingFromOneMap(r);
      if (b) out.push(b);
    }
  };
  for (const name of names) {
    if (cache[name]) {
      keep(cache[name]);
      continue;
    }
    const url = `${ONEMAP_SEARCH}?searchVal=${encodeURIComponent(name)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    // Anonymous search allows only a couple dozen quick calls before it answers
    // 429 — pace at ~1/s and back off when throttled.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(url);
        if (res.status === 429) {
          await sleep(5_000 * 2 ** attempt);
          continue;
        }
        if (!res.ok) {
          process.stderr.write(`  OneMap search "${name}": HTTP ${res.status}\n`);
          break;
        }
        const json = (await res.json()) as { results?: OneMapRecord[] };
        cache[name] = json.results ?? [];
        keep(cache[name]);
        break;
      } catch (err) {
        process.stderr.write(`  OneMap search "${name}" failed: ${err instanceof Error ? err.message : err}\n`);
        break;
      }
    }
    if (!cache[name]) process.stderr.write(`  OneMap search "${name}": gave up (still throttled)\n`);
    await sleep(1_000);
  }
  mkdirSync(dirname(SEARCH_CACHE_PATH), { recursive: true });
  writeFileSync(SEARCH_CACHE_PATH, JSON.stringify(cache, null, 1));
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Report
// ──────────────────────────────────────────────────────────────────────

function renderReport(outcomes: PlanOutcome[]): string {
  const matched = outcomes.filter((o) => o.status === 'matched');
  const skipped = outcomes.filter((o) => o.status === 'skipped');
  const unmatched = outcomes.filter((o) => o.status === 'unmatched');
  const lines: string[] = [];
  lines.push(`# LTA_DATAGOV geocode report`);
  lines.push('');
  lines.push(
    `${outcomes.length} rows: ${matched.length} matched, ${skipped.length} skipped, ${unmatched.length} unmatched.`,
  );

  lines.push('', `## Matched (${matched.length})`, '');
  for (const o of matched) {
    if (o.status !== 'matched') continue;
    lines.push(`- \`${o.row.id}\` ${o.row.name} → ${o.coord.address} (${o.coord.source}; ${o.how})`);
    if (o.nearby) {
      lines.push(
        `  - ⚠ ${o.nearby.meters} m from \`${o.nearby.id}\` "${o.nearby.name}" — check it isn't the same carpark`,
      );
    }
  }

  lines.push('', `## Skipped (${skipped.length})`, '');
  for (const o of skipped) {
    if (o.status === 'skipped') lines.push(`- \`${o.row.id}\` ${o.row.name} — ${o.reason}`);
  }

  lines.push('', `## Unmatched — left off the map (${unmatched.length})`, '');
  for (const o of unmatched) {
    if (o.status === 'unmatched') lines.push(`- \`${o.row.id}\` ${o.row.name} — ${o.reason}`);
  }
  return lines.join('\n') + '\n';
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('ERROR: set SUPABASE_URL (or VITE_SUPABASE_URL) and VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [rows, placed, protectedIds] = await Promise.all([
    loadLtaDataGovRows(supabase),
    loadPlaced(supabase),
    loadProtectedIds(supabase),
  ]);
  process.stderr.write(
    `Loaded ${rows.length} LTA_DATAGOV rows, ${placed.length} mapped carparks, ${protectedIds.size} MANUAL-rated ids.\n`,
  );

  const dump = await loadDumpBuildings(argValue('--buildings') ?? DEFAULT_BUILDINGS);
  process.stderr.write(`Indexed ${dump.length} OneMap buildings (2017 dump).\n`);
  const sources: BuildingSource[] = [{ source: 'onemap-2017', index: indexBuildings(dump) }];

  let outcomes = planCoords({ rows, buildings: sources, placed, protectedIds });

  // Second pass: ask the live OneMap search about every row the 2017 dump
  // couldn't place — renamed and newer buildings, or a stronger match for a
  // weak one ("IKEA (Alexandra)").
  if (!process.argv.includes('--no-search')) {
    const missing = outcomes.filter((o) => o.status === 'unmatched');
    const queries = [
      ...new Set(
        missing.flatMap((o) => [...reviewAliases(o.row.id), ...nameVariants(o.row.name).slice(0, 3)]),
      ),
    ];
    process.stderr.write(`Searching OneMap for ${missing.length} unmatched rows (${queries.length} queries)…\n`);
    const found = await searchOneMap(queries);
    sources.push({ source: 'onemap-search', index: indexBuildings(found) });
    outcomes = planCoords({ rows, buildings: sources, placed, protectedIds });
  }

  const report = renderReport(outcomes);
  process.stdout.write(report);
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report);
  process.stderr.write(`\nReport saved to ${REPORT_PATH}\n`);

  if (process.argv.includes('--write')) {
    const file = coordsFileFrom(outcomes);
    writeFileSync(COORDS_PATH, JSON.stringify(file, null, 2) + '\n');
    process.stderr.write(`Wrote ${Object.keys(file).length} coordinates to ${COORDS_PATH}\n`);
  } else {
    process.stderr.write('Dry run — pass --write to update scripts/data/lta-datagov-coords.json\n');
  }
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
