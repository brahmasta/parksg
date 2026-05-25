/**
 * URA Car_Park_Details → RateRow normaliser.
 *
 * URA returns ONE ROW per (carpark, day-type, time-band) tuple. A single
 * carpark may yield several rows (e.g. weekday peak + weekday off-peak +
 * Saturday + Sunday/PH). Each raw row has its own weekday/sat/sunPH rate
 * triple, but only one of the three is meaningful per row — the others
 * are zero or duplicate. We emit one structured RateRow per non-zero
 * rate the row carries.
 *
 * Fields are free-text and occasionally missing/blank. The parser is
 * defensive — a malformed row is logged and skipped rather than
 * crashing the whole carpark.
 *
 * v1: filter to CAR vehCat. Motorcycle / heavy rows are dropped (the
 * runtime currently only renders one schedule per carpark). Flag tracked
 * as a follow-up.
 */

import type { DayType, RateRow, RateSystem } from './types';
import type { UraRawRow } from './api/uraDetails';

const SOURCE = 'URA' as const;

export type UraCarparkRates = {
  /** Unique URA ppCode (e.g. "M0078"). */
  ppCode: string;
  /** Display name, title-cased. */
  ppName: string;
  /** Total lots reported by URA. */
  parkCapacity: number;
  weekday: RateRow[];
  saturday: RateRow[];
  sundayPH: RateRow[];
};

/** Bucket the per-row triples emit. Internal. */
type DayBucketKey = 'weekday' | 'saturday' | 'sundayPH';

/** Parse all URA rows into a Map keyed by ppCode. Rows for the same
 * carpark are collected together into the same buckets. */
export function parseUraRows(rows: UraRawRow[]): Map<string, UraCarparkRates> {
  const out = new Map<string, UraCarparkRates>();
  let skipped = 0;

  for (const raw of rows) {
    const ppCode = (raw.ppCode ?? '').trim();
    if (!ppCode) {
      skipped += 1;
      continue;
    }

    const veh = parseVehCat(raw.vehCat);
    if (veh !== 'CAR') {
      // v1: surface only CAR rates. Motorcycle / heavy follow in a future
      // pass when the UI can pivot by vehCat.
      continue;
    }

    let entry = out.get(ppCode);
    if (!entry) {
      entry = {
        ppCode,
        ppName: titleCase((raw.ppName ?? '').trim()),
        parkCapacity:
          typeof raw.parkCapacity === 'number' ? raw.parkCapacity : 0,
        weekday: [],
        saturday: [],
        sundayPH: [],
      };
      out.set(ppCode, entry);
    }

    const system = parseSystem(raw.parkingSystem);
    const startTime = parseUraTime(raw.startTime);
    const endTime = parseUraTime(raw.endTime);

    let yieldCount = 0;
    for (const [bucket, dayType, rateStr, minStr] of [
      ['weekday', 'WEEKDAY', raw.weekdayRate, raw.weekdayMin],
      ['saturday', 'SAT', raw.satdayRate, raw.satdayMin],
      ['sundayPH', 'SUN_PH', raw.sunPHRate, raw.sunPHMin],
    ] as [DayBucketKey, DayType, string | undefined, string | undefined][]) {
      const row = buildRow({
        rateStr,
        minStr,
        dayType,
        startTime,
        endTime,
        system,
      });
      if (row) {
        entry[bucket].push(row);
        yieldCount += 1;
      }
    }

    if (yieldCount === 0) {
      // No usable rate on any day — possible "$0.00" / "0mins" rows that
      // URA still ships for completeness. Don't error, just skip silently.
      skipped += 1;
    }
  }

  if (skipped > 0) {
    // eslint-disable-next-line no-console
    console.debug(
      `[ura] skipped ${skipped} rows with no usable rate or missing ppCode`,
    );
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Field parsers — exported for unit tests
// ────────────────────────────────────────────────────────────────────

/** Parse "$1.20" / "1.20" / "$0" / "" → cents (or null if not a number). */
export function parseDollarsToCents(s: string | undefined): number | null {
  if (s == null) return null;
  const cleaned = s.replace(/[$,\s]/g, '').trim();
  if (!cleaned) return null;
  const v = parseFloat(cleaned);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

/** Parse "30mins" / "30 min" / "30" → integer minutes (or null). */
export function parseMinutes(s: string | undefined): number | null {
  if (s == null) return null;
  const m = /(\d+)/.exec(s);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Parse URA's "08.30 AM" / "05.00 PM" / "12.00 AM" → 'HH:mm' 24h.
 * Returns undefined for blanks or unparseable strings. */
export function parseUraTime(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = /^(\d{1,2})[.:](\d{2})\s*(am|pm)?$/i.exec(s.trim());
  if (!m) return undefined;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return undefined;
  const meridiem = (m[3] ?? '').toLowerCase();
  if (meridiem === 'am') {
    if (h === 12) h = 0;
  } else if (meridiem === 'pm') {
    if (h !== 12) h += 12;
  }
  if (h < 0 || h > 23 || min < 0 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseSystem(s: string | undefined): RateSystem | undefined {
  const v = (s ?? '').trim().toUpperCase();
  if (v === 'B' || v === 'EPS') return 'EPS';
  if (v === 'C' || v === 'COUPON') return 'COUPON';
  return undefined;
}

export function parseVehCat(s: string | undefined): 'CAR' | 'MOTORCYCLE' | 'HEAVY' | undefined {
  const v = (s ?? '').trim().toLowerCase();
  if (v === 'car') return 'CAR';
  if (v.startsWith('motor')) return 'MOTORCYCLE';
  if (v.startsWith('heavy')) return 'HEAVY';
  return undefined;
}

// ────────────────────────────────────────────────────────────────────
// Row builder
// ────────────────────────────────────────────────────────────────────

function buildRow({
  rateStr,
  minStr,
  dayType,
  startTime,
  endTime,
  system,
}: {
  rateStr: string | undefined;
  minStr: string | undefined;
  dayType: DayType;
  startTime: string | undefined;
  endTime: string | undefined;
  system: RateSystem | undefined;
}): RateRow | null {
  const perBlockCents = parseDollarsToCents(rateStr);
  const blockMinutes = parseMinutes(minStr);
  // A "0 / 0min" row is URA's way of saying "this day not priced in this band".
  // Skip cleanly rather than emit a zero-cost row.
  if (perBlockCents == null || perBlockCents === 0) return null;
  if (blockMinutes == null) return null;

  return {
    dayType,
    startTime,
    endTime,
    perBlockCents,
    blockMinutes,
    system,
    vehCat: 'CAR',
    source: SOURCE,
  };
}

// ────────────────────────────────────────────────────────────────────
// Misc
// ────────────────────────────────────────────────────────────────────

const ALL_CAPS = /\b(?:HDB|URA|LTA|MSCP|MRT|SMRT|CBD|JEM|VIP|PIE|BKE|TPE|KPE|ECP|NSE|AYE|CTE|ICA|SAFRA|NTUC|NUS|NTU|SMU|SIM|MBS|YTL|SP|EV|AC|DC|JLN|BLK)\b/gi;
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(ALL_CAPS, (m) => m.toUpperCase());
}
