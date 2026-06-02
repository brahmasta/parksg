/**
 * OSM parking coverage audit — count net-new carparks vs our Supabase spine.
 *
 * One-shot, THROWAWAY analysis script (not a production ingest). Pulls every
 * car park in Singapore from OpenStreetMap via Overpass, compares it against
 * our existing Supabase `carparks` spine by spatial proximity (60 m haversine),
 * and reports how many OSM carparks are NOT already in our DB — i.e. candidate
 * net-new inventory (MCST condos, office towers, small commercial lots that the
 * HDB/URA/LTA/JTC/NParks feeds miss).
 *
 * Run from the project root:
 *   npx tsx scripts/audit-osm-coverage.ts
 *   # or: npm run audit:osm
 *
 * Env (read from .env / .env.local):
 *   VITE_SUPABASE_URL       required (falls back to SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY  required (falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * READ-ONLY: this script only issues GET requests to PostgREST. It never
 * inserts/updates/upserts to Supabase and runs no migrations.
 *
 * LICENSING NOTE: OpenStreetMap data is licensed under the ODbL, which is
 * SHARE-ALIKE. If we later decide to ingest any of these net-new carparks, the
 * OSM-derived rows MUST live in an ISOLATED table (clearly attributed to OSM),
 * NOT merged into our proprietary `carparks` store — otherwise the share-alike
 * obligation could attach to the whole dataset. This audit produces only counts
 * + a CSV for human review; it ingests nothing.
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';

// ──────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────

const OVERPASS_PRIMARY = 'https://overpass-api.de/api/interpreter';
const OVERPASS_MIRROR = 'https://overpass.kumi.systems/api/interpreter';

// Singapore relation 536780 → Overpass area id 3600536780.
const OVERPASS_QUERY = `[out:json][timeout:90];
area(id:3600536780)->.sg;
(
  node["amenity"="parking"](area.sg);
  way["amenity"="parking"](area.sg);
  relation["amenity"="parking"](area.sg);
)->.allparking;
(
  .allparking;
  - (
      node.allparking["parking"~"^(bicycle|motorcycle)$"];
      way.allparking["parking"~"^(bicycle|motorcycle)$"];
      relation.allparking["parking"~"^(bicycle|motorcycle)$"];
    );
);
out center tags;
`;

const MATCH_RADIUS_M = 60; // a starting point — see the distance histogram below.
const GRID_CELL_DEG = 0.0006; // ≈ 66 m at the equator; one cell ≳ the match radius.
const CSV_PATH = 'scripts/out/osm_not_in_db.csv';

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

type OsmCarpark = {
  osm_type: string;
  osm_id: number;
  lat: number;
  lng: number;
  name: string;
  operator: string;
  access: string;
  parking: string;
  capacity: string;
};

type DbCarpark = {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  agency: string | null;
};

// ──────────────────────────────────────────────────────────────────────
// Env loading (mirrors scripts/audit-datamall.ts)
// ──────────────────────────────────────────────────────────────────────

function loadDotenvIfAvailable(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv') as {
      config: (opts?: { path?: string }) => unknown;
    };
    dotenv.config();
    dotenv.config({ path: '.env.local' });
  } catch {
    // dotenv not installed — fall through to process.env.
  }
}

// ──────────────────────────────────────────────────────────────────────
// Distance math
// ──────────────────────────────────────────────────────────────────────

const R = 6_371_000;
const toRad = (d: number): number => (d * Math.PI) / 180;
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dphi = toRad(lat2 - lat1);
  const dlam = toRad(lon2 - lon1);
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlam / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ──────────────────────────────────────────────────────────────────────
// Step 1 — Overpass fetch
// ──────────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchOverpassFrom(endpoint: string): Promise<OverpassElement[]> {
  const body = new URLSearchParams({ data: OVERPASS_QUERY });
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpass instances reject anonymous/default UAs (mirror 429s, primary
      // 406s) — a meaningful User-Agent is required by their usage policy.
      'User-Agent': 'parksg-osm-coverage-audit/1.0 (wheretopark.sg; one-shot analysis)',
      Accept: 'application/json',
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Overpass ${res.status} ${res.statusText}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as OverpassResponse;
  return json.elements ?? [];
}

/** Fetch with up to 3 retries + backoff on the primary, then the mirror. */
async function fetchOsmParking(): Promise<OverpassElement[]> {
  const endpoints = [OVERPASS_PRIMARY, OVERPASS_MIRROR];
  let lastErr: unknown;
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        process.stderr.write(`  POST ${endpoint} (attempt ${attempt}/3)\n`);
        const els = await fetchOverpassFrom(endpoint);
        process.stderr.write(`  → ${els.length} elements\n`);
        return els;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`  ! ${msg}\n`);
        if (attempt < 3) {
          const backoffMs = 2_000 * 2 ** (attempt - 1); // 2s, 4s
          await sleep(backoffMs);
        }
      }
    }
    process.stderr.write(`  endpoint exhausted, falling back to mirror…\n`);
  }
  throw new Error(
    `Overpass failed on all endpoints: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

function toOsmCarparks(elements: OverpassElement[]): OsmCarpark[] {
  const out: OsmCarpark[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue; // no resolvable coordinates — skip.
    }
    const tags = el.tags ?? {};
    out.push({
      osm_type: el.type,
      osm_id: el.id,
      lat,
      lng,
      name: tags.name ?? '',
      operator: tags.operator ?? '',
      access: tags.access ?? '',
      parking: tags.parking ?? '',
      capacity: tags.capacity ?? '',
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Step 2 — Supabase spine (read-only, paginated)
// ──────────────────────────────────────────────────────────────────────

async function fetchSpine(urlBase: string, anonKey: string): Promise<DbCarpark[]> {
  const PAGE = 1000; // PostgREST hard caps responses at 1000 rows/page.
  const all: DbCarpark[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const params = new URLSearchParams({
      select: 'id,name,lat,lng,agency',
      order: 'id.asc',
    });
    const res = await fetch(`${urlBase}/rest/v1/carparks?${params.toString()}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
        Range: `${from}-${to}`,
        'Range-Unit': 'items',
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Supabase carparks ${res.status}: ${detail.slice(0, 200)}`);
    }
    const page = (await res.json()) as Array<{
      id: string;
      name: string | null;
      lat: number | null;
      lng: number | null;
      agency: string | null;
    }>;
    for (const r of page) {
      if (r.lat == null || r.lng == null) continue; // null-coord rows can't be matched spatially.
      all.push({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, agency: r.agency });
    }
    process.stderr.write(`  spine page ${from}-${to}: +${page.length} rows (total ${all.length})\n`);
    if (page.length < PAGE) break;
  }
  return all;
}

// ──────────────────────────────────────────────────────────────────────
// Step 3 — Grid-indexed spatial match
// ──────────────────────────────────────────────────────────────────────

const cellKey = (lat: number, lng: number): string =>
  `${Math.floor(lat / GRID_CELL_DEG)},${Math.floor(lng / GRID_CELL_DEG)}`;

function buildGrid(db: DbCarpark[]): Map<string, DbCarpark[]> {
  const grid = new Map<string, DbCarpark[]>();
  for (const cp of db) {
    const key = cellKey(cp.lat, cp.lng);
    const bucket = grid.get(key);
    if (bucket) bucket.push(cp);
    else grid.set(key, [cp]);
  }
  return grid;
}

/** Nearest DB carpark within MATCH_RADIUS_M, checking the OSM point's cell + 8 neighbours. */
function nearestWithinRadius(
  osm: OsmCarpark,
  grid: Map<string, DbCarpark[]>,
): { cp: DbCarpark; dist: number } | null {
  const baseLat = Math.floor(osm.lat / GRID_CELL_DEG);
  const baseLng = Math.floor(osm.lng / GRID_CELL_DEG);
  let best: { cp: DbCarpark; dist: number } | null = null;
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      const bucket = grid.get(`${baseLat + dLat},${baseLng + dLng}`);
      if (!bucket) continue;
      for (const cp of bucket) {
        const dist = haversineM(osm.lat, osm.lng, cp.lat, cp.lng);
        if (dist <= MATCH_RADIUS_M && (best == null || dist < best.dist)) {
          best = { cp, dist };
        }
      }
    }
  }
  return best;
}

// ──────────────────────────────────────────────────────────────────────
// Step 4 — CSV
// ──────────────────────────────────────────────────────────────────────

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: OsmCarpark[]): string {
  const header = ['osm_type', 'osm_id', 'name', 'operator', 'access', 'parking', 'capacity', 'lat', 'lng'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.osm_type, r.osm_id, r.name, r.operator, r.access, r.parking, r.capacity, r.lat, r.lng]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadDotenvIfAvailable();

  const urlBase =
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!urlBase || !anonKey) {
    console.error(
      'ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (in .env / .env.local).',
    );
    process.exit(1);
  }

  process.stderr.write('Fetching OSM parking via Overpass…\n');
  const elements = await fetchOsmParking();
  const osm = toOsmCarparks(elements);
  process.stderr.write(`  usable OSM carparks (with coords): ${osm.length}\n`);

  process.stderr.write('Fetching Supabase carpark spine (read-only)…\n');
  const db = await fetchSpine(urlBase, anonKey);
  process.stderr.write(`  spine carparks (with coords): ${db.length}\n`);

  const grid = buildGrid(db);

  // Match every OSM carpark against the spine.
  const matchedOsm: OsmCarpark[] = [];
  const unmatchedOsm: OsmCarpark[] = [];
  const matchedDbIds = new Set<string>();
  const histo = { '0-20': 0, '20-40': 0, '40-60': 0 };

  for (const o of osm) {
    const hit = nearestWithinRadius(o, grid);
    if (hit) {
      matchedOsm.push(o);
      matchedDbIds.add(hit.cp.id);
      if (hit.dist < 20) histo['0-20'] += 1;
      else if (hit.dist < 40) histo['20-40'] += 1;
      else histo['40-60'] += 1;
    } else {
      unmatchedOsm.push(o);
    }
  }

  const unmatchedNamed = unmatchedOsm.filter((o) => o.name.trim() !== '');

  // Our carparks that OSM misses (no OSM point matched them), by agency.
  const dbMissedByAgency: Record<string, number> = {};
  let dbMissedTotal = 0;
  for (const cp of db) {
    if (matchedDbIds.has(cp.id)) continue;
    dbMissedTotal += 1;
    const key = cp.agency && cp.agency.trim() !== '' ? cp.agency : '(blank)';
    dbMissedByAgency[key] = (dbMissedByAgency[key] ?? 0) + 1;
  }

  // Write the net-new candidates CSV.
  const outPath = resolve(process.cwd(), CSV_PATH);
  await mkdir(resolve(process.cwd(), 'scripts/out'), { recursive: true });
  await writeFile(outPath, toCsv(unmatchedOsm), 'utf8');

  // ── Report ──
  // Always print the canonical agencies (even at 0) so the block matches the
  // expected report shape; append any unexpected agency labels after.
  const agencyOrder = ['HDB', 'URA', 'JTC', 'NPARKS', 'LTA', 'OPERATOR', '(blank)'];
  const agencyKeys = [
    ...agencyOrder,
    ...Object.keys(dbMissedByAgency).filter((k) => !agencyOrder.includes(k)),
  ];
  const agencyLine = agencyKeys
    .map((k) => `${k} ${dbMissedByAgency[k] ?? 0}`)
    .join(', ');

  const pad = (n: number): string => String(n).padStart(6);
  console.log('');
  console.log('=== OSM Parking Coverage Audit ===');
  console.log(`OSM parking total            : ${pad(osm.length)}`);
  console.log(`Supabase carparks total      : ${pad(db.length)}`);
  console.log(`OSM carparks ALSO in our DB  : ${pad(matchedOsm.length)}`);
  console.log(`OSM carparks NOT in our DB   : ${pad(unmatchedOsm.length)}   <-- candidate net-new`);
  console.log(`   …of which have an OSM name : ${pad(unmatchedNamed.length)}`);
  console.log(`Our carparks OSM misses      : ${pad(dbMissedTotal)}`);
  console.log(`   by agency: ${agencyLine}`);
  console.log('');
  console.log(`Match-distance histogram (matched OSM, radius ${MATCH_RADIUS_M} m):`);
  console.log(`   0-20 m : ${pad(histo['0-20'])}`);
  console.log(`  20-40 m : ${pad(histo['20-40'])}`);
  console.log(`  40-60 m : ${pad(histo['40-60'])}`);
  console.log('');
  console.log(`Net-new candidates CSV → ${CSV_PATH}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFAILED: ${msg}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
