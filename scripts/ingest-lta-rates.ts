/**
 * E3.2 — Ingest the data.gov.sg "LTA Carpark Rates" dataset
 * (d_9f6056bdb6b1dfba57f063593e4f34ae, ~357 rows from a 2018 snapshot).
 *
 * Fetches via the Dataset API v2 poll-download endpoint, parses each
 * free-text rate string into a tiered RateRow[], and writes:
 *
 *   src/lib/data/ltaRates.json
 *     A committed asset keyed by normalized carpark name. The runtime
 *     reads this — there's no live API call on the user path.
 *
 *   scripts/out/lta-rates-unparsed.json
 *     Carparks where at least one day-type rate string could not be
 *     confidently parsed. NOT in the runtime corpus — for review only.
 *
 * Run:
 *   npx tsx scripts/ingest-lta-rates.ts
 *   npm run ingest:lta-rates
 */

import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';

import { parseDayRate, type ParseDayResult } from './lib/parse-lta-rate';
import type { RateRow } from '../src/lib/types';

// ────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────

const DATASET_ID = 'd_9f6056bdb6b1dfba57f063593e4f34ae';
// Dataset API — the live host is api-open.data.gov.sg/v1, not the v2 path
// shown in some docs. poll-download returns { code, data: { status, url } };
// on DOWNLOAD_SUCCESS the URL is a signed S3 link to the CSV.
const POLL_URL = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}/poll-download`;
const OUT_CORPUS = 'src/lib/data/ltaRates.json';
const OUT_UNPARSED = 'scripts/out/lta-rates-unparsed.json';

type Row = Record<string, string>;

type CarparkRates = {
  /** Source name as it appears in the CSV. */
  rawName: string;
  /** Normalized key (lowercase, punctuation stripped, single-spaced). */
  key: string;
  weekday: RateRow[];
  saturday: RateRow[];
  sundayPH: RateRow[];
};

type Corpus = {
  generatedAt: string;
  datasetId: string;
  effectiveFrom: string;
  count: number;
  carparks: Record<string, Omit<CarparkRates, 'key'>>;
};

type Unparsed = {
  generatedAt: string;
  datasetId: string;
  count: number;
  rows: Array<{
    rawName: string;
    reasons: Record<string, string>;
    raw: Record<string, string>;
  }>;
};

// ────────────────────────────────────────────────────────────────────
// Fetch
// ────────────────────────────────────────────────────────────────────

type PollResponse = {
  code: number;
  data?: { url?: string; status?: string };
  errMsg?: string;
  message?: string;
};

/** Hits the v2 poll-download endpoint and follows the signed CSV URL. */
async function downloadCsv(): Promise<string> {
  // The endpoint is named "poll" but in practice it returns the signed URL
  // on the first call. We re-poll up to a few times in case status is PENDING.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(POLL_URL);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Poll endpoint returned ${res.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as PollResponse;
    if (body.code !== 0 || !body.data) {
      throw new Error(`Poll endpoint returned non-zero code: ${JSON.stringify(body).slice(0, 300)}`);
    }
    if (body.data.url) {
      const csvRes = await fetch(body.data.url);
      if (!csvRes.ok) {
        throw new Error(`CSV download returned ${csvRes.status}`);
      }
      return await csvRes.text();
    }
    // Not ready yet — back off briefly.
    await new Promise<void>((r) => setTimeout(r, 1500));
  }
  throw new Error('Poll endpoint never returned a CSV URL after 5 attempts');
}

// ────────────────────────────────────────────────────────────────────
// CSV parsing — minimal RFC 4180-ish reader
// ────────────────────────────────────────────────────────────────────

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cur.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => {
      const obj: Row = {};
      for (let i = 0; i < header.length; i += 1) {
        obj[header[i]] = (r[i] ?? '').trim();
      }
      return obj;
    });
}

// ────────────────────────────────────────────────────────────────────
// Normalization
// ────────────────────────────────────────────────────────────────────

/** Normalize a carpark name for matching. Lowercase, strip punctuation,
 * collapse whitespace. Keeps digits and the "@" character common in
 * names like "313@Somerset". */
export function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9@ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ────────────────────────────────────────────────────────────────────
// Per-row mapping
// ────────────────────────────────────────────────────────────────────

const DAY_COLUMNS = ['weekdays_rate_1', 'weekdays_rate_2', 'saturday_rate', 'sunday_publicholiday_rate'] as const;

type DayKey = (typeof DAY_COLUMNS)[number];

const COLUMN_TO_BUCKET: Record<DayKey, 'weekday' | 'saturday' | 'sundayPH'> = {
  weekdays_rate_1: 'weekday',
  weekdays_rate_2: 'weekday',
  saturday_rate: 'saturday',
  sunday_publicholiday_rate: 'sundayPH',
};

type ParseOutcome =
  | { ok: true; carpark: CarparkRates }
  | { ok: false; rawName: string; reasons: Record<string, string>; raw: Record<string, string> };

/** Resolve "Same as wkdays / Saturday / Sunday" placeholders by substituting
 * the referenced column's text BEFORE parsing. Common in this dataset. */
function resolveDeferrals(row: Row): Row {
  const out = { ...row };
  const isWkdayRef = /same\s*as\s*(?:wk\.?d(?:ay)?s?|weekdays?)/i;
  const isSatRef = /same\s*as\s*sat(?:urday)?s?/i;
  const isSunRef = /same\s*as\s*sun(?:day)?s?(?:\s*&?\s*p\.?h\.?)?/i;
  const isAboveRef = /same\s*as\s*above/i;

  const swap = (col: DayKey, src: string) => {
    const v = (out[col] ?? '').trim();
    if (!v) return;
    if (isWkdayRef.test(v)) out[col] = src ? out.weekdays_rate_1 ?? '' : '';
    else if (isSatRef.test(v)) out[col] = out.saturday_rate ?? '';
    else if (isSunRef.test(v)) out[col] = out.sunday_publicholiday_rate ?? '';
    else if (isAboveRef.test(v)) {
      // "Same as above" — copy from the column immediately before in DAY_COLUMNS
      const idx = DAY_COLUMNS.indexOf(col);
      if (idx > 0) out[col] = out[DAY_COLUMNS[idx - 1]] ?? '';
    }
  };

  swap('weekdays_rate_2', out.weekdays_rate_1 ?? '');
  swap('saturday_rate', out.weekdays_rate_1 ?? '');
  swap('sunday_publicholiday_rate', out.saturday_rate ?? '');
  return out;
}

function parseRow(rawRow: Row): ParseOutcome {
  const row = resolveDeferrals(rawRow);
  const rawName =
    row.carpark || row.car_park || row.development || row.name || row.Carpark || '';
  if (!rawName) {
    return {
      ok: false,
      rawName: '(missing name)',
      reasons: { _row: 'no carpark name column' },
      raw: rawRow,
    };
  }
  const key = normalizeKey(rawName);

  const buckets: Record<'weekday' | 'saturday' | 'sundayPH', RateRow[]> = {
    weekday: [],
    saturday: [],
    sundayPH: [],
  };
  const reasons: Record<string, string> = {};

  for (const col of DAY_COLUMNS) {
    const raw = row[col];
    const result: ParseDayResult = parseDayRate(raw);
    if (!result.ok) {
      reasons[col] = `${result.reason} :: ${JSON.stringify(raw)}`;
    } else {
      buckets[COLUMN_TO_BUCKET[col]].push(...result.rows);
    }
  }

  if (Object.keys(reasons).length > 0) {
    return { ok: false, rawName, reasons, raw: rawRow };
  }

  // A row that parsed but yielded no rate rows at all (all cols empty / "Closed"
  // / etc.) is treated as having no usable rate data — keep it out of the
  // corpus, but don't flag as an error.
  const totalRows = buckets.weekday.length + buckets.saturday.length + buckets.sundayPH.length;
  if (totalRows === 0) {
    return {
      ok: false,
      rawName,
      reasons: { _row: 'no rate rows after parse (all cells empty/closed/opaque)' },
      raw: rawRow,
    };
  }

  return {
    ok: true,
    carpark: {
      rawName,
      key,
      weekday: buckets.weekday,
      saturday: buckets.saturday,
      sundayPH: buckets.sundayPH,
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  process.stderr.write('Fetching dataset...\n');
  const csv = await downloadCsv();
  const rows = parseCsv(csv);
  process.stderr.write(`  parsed ${rows.length} CSV rows\n`);

  const parsed: Record<string, Omit<CarparkRates, 'key'>> = {};
  const unparsed: Unparsed['rows'] = [];

  for (const row of rows) {
    const out = parseRow(row);
    if (out.ok) {
      const { key, ...rest } = out.carpark;
      // If two rows collide on normalized key, keep the first (most likely
      // the canonical entry) and skip duplicates silently.
      if (!parsed[key]) parsed[key] = rest;
    } else {
      unparsed.push({ rawName: out.rawName, reasons: out.reasons, raw: out.raw });
    }
  }

  const corpus: Corpus = {
    generatedAt: new Date().toISOString(),
    datasetId: DATASET_ID,
    effectiveFrom: '2018-11-01',
    count: Object.keys(parsed).length,
    carparks: parsed,
  };

  const unparsedReport: Unparsed = {
    generatedAt: new Date().toISOString(),
    datasetId: DATASET_ID,
    count: unparsed.length,
    rows: unparsed,
  };

  const corpusPath = resolve(process.cwd(), OUT_CORPUS);
  const unparsedPath = resolve(process.cwd(), OUT_UNPARSED);
  await mkdir(dirname(corpusPath), { recursive: true });
  await mkdir(dirname(unparsedPath), { recursive: true });
  await writeFile(corpusPath, JSON.stringify(corpus, null, 2) + '\n', 'utf8');
  await writeFile(unparsedPath, JSON.stringify(unparsedReport, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('=== LTA Rates Ingest ===');
  console.log(`Total CSV rows:   ${rows.length}`);
  console.log(`Parsed carparks:  ${corpus.count}`);
  console.log(`Unparsed rows:    ${unparsedReport.count}`);
  console.log('');
  console.log(`Corpus  → ${OUT_CORPUS}`);
  console.log(`Review  → ${OUT_UNPARSED}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFAILED: ${msg}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
