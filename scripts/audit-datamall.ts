/**
 * E1 — Audit LTA DataMall payload.
 *
 * One-shot CLI script. Paginates the CarParkAvailabilityv2 endpoint,
 * de-dupes by CarParkID, groups by Agency, extracts LTA-managed
 * carparks, runs a coverage matrix against 30 reference developments,
 * and writes datamall-audit-report.json plus a human-readable summary.
 *
 * Run from the project root:
 *   npx ts-node scripts/audit-datamall.ts
 *
 * (A scripts/tsconfig.json + scripts/package.json scope this folder to
 * CommonJS so ts-node works even though the root project is "type":
 * "module".)
 *
 * Env:
 *   LTA_ACCOUNT_KEY   required, from datamall.lta.gov.sg
 *
 * The script tries to load .env / .env.local via dotenv if the package
 * is installed; otherwise it just reads process.env directly.
 */

import { writeFile } from 'fs/promises';
import { resolve } from 'path';

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

type DataMallValue = {
  CarParkID: string;
  Area?: string;
  Development?: string;
  /** Space-separated "lat lng". */
  Location?: string;
  AvailableLots?: number;
  LotType?: string;
  Agency?: string;
};

type DataMallResponse = {
  value?: DataMallValue[];
  'odata.metadata'?: string;
};

type LtaCarpark = {
  CarParkID: string;
  Development: string;
  Area: string;
  lat: number;
  lng: number;
  AvailableLots: number;
  LotType: string;
};

type Report = {
  fetchedAt: string;
  totalRecords: number;
  byAgency: Record<string, number>;
  ltaCarparks: LtaCarpark[];
  coverageMatrix: Record<string, boolean>;
  gaps: string[];
};

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────

const UPSTREAM =
  'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2';
const PAGE_SIZE = 500;
const SAFETY_CAP = 50_000; // skip values above this end the loop defensively
const REPORT_PATH = 'datamall-audit-report.json';

const REFERENCE_DEVELOPMENTS = [
  'ION Orchard',
  'Wisma Atria',
  'Paragon',
  'Ngee Ann City',
  'Takashimaya',
  'Orchard Central',
  '313 Somerset',
  'Plaza Singapura',
  'Bugis Junction',
  'Funan',
  'Raffles City',
  'Suntec City',
  'Marina Square',
  'Millenia Walk',
  'Esplanade Mall',
  'Marina Bay Sands',
  'Harbourfront Centre',
  'VivoCity',
  'Jewel Changi',
  'Resorts World Sentosa',
  'Westgate',
  'JEM',
  'IMM',
  'JCube',
  'Jurong Point',
  'Causeway Point',
  'Northpoint City',
  'Tampines Mall',
  'Bedok Mall',
  'Capital Tower',
] as const;

// ──────────────────────────────────────────────────────────────────────
// Env loading
// ──────────────────────────────────────────────────────────────────────

function loadDotenvIfAvailable(): void {
  try {
    // Resolved lazily so missing dotenv just falls through.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv') as {
      config: (opts?: { path?: string }) => unknown;
    };
    dotenv.config();
    dotenv.config({ path: '.env.local' });
  } catch {
    // dotenv not installed — that's fine.
  }
}

// ──────────────────────────────────────────────────────────────────────
// Fetch
// ──────────────────────────────────────────────────────────────────────

async function fetchAllPages(key: string): Promise<DataMallValue[]> {
  const all: DataMallValue[] = [];
  for (let skip = 0; skip <= SAFETY_CAP; skip += PAGE_SIZE) {
    const url = skip === 0 ? UPSTREAM : `${UPSTREAM}?$skip=${skip}`;
    process.stderr.write(`  GET ${url}\n`);
    const res = await fetch(url, {
      headers: { AccountKey: key, accept: 'application/json' },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `DataMall returned ${res.status} ${res.statusText} for skip=${skip}: ${detail.slice(0, 300)}`,
      );
    }
    const body = (await res.json()) as DataMallResponse;
    const page = body.value ?? [];
    if (page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

// ──────────────────────────────────────────────────────────────────────
// Transforms
// ──────────────────────────────────────────────────────────────────────

/** Keep the first occurrence per CarParkID. The DataMall returns the same
 * physical carpark once per LotType (C, Y, H); dedupe collapses those into
 * a single record so downstream counts are by-carpark, not by-lottype. */
function dedupeByCarParkID(raw: DataMallValue[]): DataMallValue[] {
  const seen = new Set<string>();
  const out: DataMallValue[] = [];
  for (const v of raw) {
    if (!v.CarParkID) continue;
    if (seen.has(v.CarParkID)) continue;
    seen.add(v.CarParkID);
    out.push(v);
  }
  return out;
}

function groupByAgency(rows: DataMallValue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const a = (r.Agency ?? 'UNKNOWN').toUpperCase();
    counts[a] = (counts[a] ?? 0) + 1;
  }
  return counts;
}

function extractLtaCarparks(rows: DataMallValue[]): LtaCarpark[] {
  return rows
    .filter((r) => (r.Agency ?? '').toUpperCase() === 'LTA')
    .map<LtaCarpark>((r) => {
      const [latStr = '', lngStr = ''] = (r.Location ?? '').split(/\s+/);
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      return {
        CarParkID: r.CarParkID,
        Development: r.Development ?? '',
        Area: r.Area ?? '',
        lat: Number.isFinite(lat) ? lat : NaN,
        lng: Number.isFinite(lng) ? lng : NaN,
        AvailableLots:
          typeof r.AvailableLots === 'number' ? r.AvailableLots : 0,
        LotType: r.LotType ?? '',
      };
    })
    .sort((a, b) =>
      a.Development.localeCompare(b.Development, 'en', { sensitivity: 'base' }),
    );
}

function buildCoverageMatrix(
  ltaCarparks: LtaCarpark[],
): Record<string, boolean> {
  const haystack = ltaCarparks
    .map((c) => c.Development.toLowerCase())
    .filter(Boolean);
  const out: Record<string, boolean> = {};
  for (const ref of REFERENCE_DEVELOPMENTS) {
    const needle = ref.toLowerCase();
    out[ref] = haystack.some((d) => d.includes(needle));
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Output
// ──────────────────────────────────────────────────────────────────────

function printSummary(report: Report): void {
  const covered = REFERENCE_DEVELOPMENTS.filter((r) => report.coverageMatrix[r]);
  const agencyParts = Object.entries(report.byAgency)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}: ${v}`);

  console.log('');
  console.log('=== DataMall Audit ===');
  console.log(`Fetched at:    ${report.fetchedAt}`);
  console.log(
    `Total records: ${report.totalRecords}  (${agencyParts.join(' | ')})`,
  );
  console.log(`LTA-managed carparks found: ${report.ltaCarparks.length}`);
  console.log('');
  console.log(`Coverage matrix (${REFERENCE_DEVELOPMENTS.length} reference malls):`);
  console.log(`  ✓ COVERED (${covered.length}): ${covered.join(', ')}`);
  console.log(`  ✗ GAPS (${report.gaps.length}):     ${report.gaps.join(', ')}`);
  console.log('');
  console.log(`Report written → ${REPORT_PATH}`);
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadDotenvIfAvailable();

  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) {
    console.error(
      'ERROR: LTA_ACCOUNT_KEY is not set.\n' +
        '  Add it to .env / .env.local, or export it in your shell:\n' +
        '    export LTA_ACCOUNT_KEY=your_key_here\n' +
        '  Register at https://datamall.lta.gov.sg to obtain a key.',
    );
    process.exit(1);
  }

  process.stderr.write('Fetching DataMall CarParkAvailabilityv2...\n');
  const raw = await fetchAllPages(key);
  process.stderr.write(`  raw rows: ${raw.length}\n`);

  const deduped = dedupeByCarParkID(raw);
  process.stderr.write(`  deduped:  ${deduped.length}\n`);

  const byAgency = groupByAgency(deduped);
  const ltaCarparks = extractLtaCarparks(deduped);
  const coverageMatrix = buildCoverageMatrix(ltaCarparks);
  const gaps = REFERENCE_DEVELOPMENTS.filter((r) => !coverageMatrix[r]);

  const report: Report = {
    fetchedAt: new Date().toISOString(),
    totalRecords: deduped.length,
    byAgency,
    ltaCarparks,
    coverageMatrix,
    gaps,
  };

  const outPath = resolve(process.cwd(), REPORT_PATH);
  await writeFile(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  printSummary(report);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFAILED: ${msg}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
