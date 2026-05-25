/**
 * Runtime lookup against the committed LTA Rates corpus.
 *
 * The corpus comes from scripts/ingest-lta-rates.ts and is keyed by a
 * normalized carpark name. We do an exact normalized-key match — close
 * enough for malls/hotels/attractions, which is the corpus' scope.
 *
 * If a carpark hits, we replace its (placeholder) rates schedule with
 * the corpus rows and recompute estByHours from the structured fields.
 * Unmatched carparks keep their existing schedule.
 */

import type { Carpark, DurationHours, RateRow } from '../types';
import { estimateCostCents } from '../rateMath';
import corpusJson from './ltaRates.json';

type Corpus = {
  generatedAt: string;
  datasetId: string;
  effectiveFrom: string;
  count: number;
  carparks: Record<
    string,
    {
      rawName: string;
      weekday: RateRow[];
      saturday: RateRow[];
      sundayPH: RateRow[];
    }
  >;
};

const CORPUS = corpusJson as Corpus;

/** Same algorithm as scripts/ingest-lta-rates.ts so keys line up. */
export function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9@ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DURATION_VALUES: DurationHours[] = [0.5, 1, 1.5, 2, 3, 4];

/** Compute estByHours from a weekday RateRow[]. Returns null if no row in
 * the schedule has structured info we can reason about. */
function computeEstByHours(rows: RateRow[]): Carpark['estByHours'] | null {
  const result: Partial<Record<DurationHours, number>> = {};
  for (const d of DURATION_VALUES) {
    const cents = estimateCostCents(rows, d);
    if (cents == null) return null;
    result[d] = +(cents / 100).toFixed(2);
  }
  return result as Carpark['estByHours'];
}

export type ApplyResult = {
  carparks: Carpark[];
  matchedCount: number;
  /** Names of nearby carparks we tried but didn't match against the corpus. */
  unmatchedNames: string[];
  /** Total corpus size, for coverage-style logging. */
  corpusSize: number;
};

/** Look up a corpus entry for a carpark name. Tries exact normalized
 * match first, then a word-boundary substring match (corpus key starts
 * with carpark key + " ", or vice versa) — handles cases like
 * "Vivocity P3" ↔ "Vivocity P3 Carpark" and "Maritime Square D Off
 * Street" ↔ "Maritime Square". When multiple corpus entries match, the
 * one closest in length wins (most specific). */
function findEntry(cpName: string): { key: string; entry: Corpus['carparks'][string] } | null {
  const cpKey = normalizeKey(cpName);
  if (!cpKey) return null;
  const exact = CORPUS.carparks[cpKey];
  if (exact) return { key: cpKey, entry: exact };

  const candidates: Array<{ key: string; entry: Corpus['carparks'][string] }> = [];
  for (const [k, entry] of Object.entries(CORPUS.carparks)) {
    if (k.startsWith(cpKey + ' ') || cpKey.startsWith(k + ' ')) {
      candidates.push({ key: k, entry });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => Math.abs(a.key.length - cpKey.length) - Math.abs(b.key.length - cpKey.length),
  );
  return candidates[0];
}

/** Try to attach corpus rates to each carpark by name. Carparks that miss
 * keep their original rates and estByHours (the operator fallback). */
export function applyLtaRates(carparks: Carpark[]): ApplyResult {
  let matchedCount = 0;
  const unmatchedNames: string[] = [];

  const out = carparks.map((cp) => {
    // Skip HDB — the operator-tariff numbers are already accurate and
    // the corpus contains malls/hotels/attractions, not HDB lots.
    if (cp.operator === 'HDB') return cp;

    const found = findEntry(cp.name);
    if (!found) {
      unmatchedNames.push(cp.name);
      return cp;
    }
    const hit = found.entry;

    // Prefer weekday rates for the cost estimate (most common stay) and
    // fall back to whichever day has structured rows.
    const ratesSource =
      hit.weekday.find((r) => r.perBlockCents != null || r.perEntryCents != null || r.firstHourCents != null)
        ? hit.weekday
        : hit.saturday.length > 0
          ? hit.saturday
          : hit.sundayPH;
    const estByHours = computeEstByHours(ratesSource);
    matchedCount += 1;

    return {
      ...cp,
      rates: {
        weekday: hit.weekday,
        saturday: hit.saturday,
        sundayPH: hit.sundayPH,
      },
      // Only replace estByHours when we got a real number across all
      // durations — otherwise the operator fallback is still safer.
      estByHours: estByHours ?? cp.estByHours,
    };
  });

  return {
    carparks: out,
    matchedCount,
    unmatchedNames,
    corpusSize: CORPUS.count,
  };
}

/** Console log of coverage. Called once per resolved result; intentionally
 * concise so it doesn't drown DevTools. Only runs in dev. */
export function logCoverage(result: ApplyResult): void {
  if (!import.meta.env.DEV) return;
  if (result.matchedCount === 0 && result.unmatchedNames.length === 0) return;
  // eslint-disable-next-line no-console
  console.debug(
    `[lta-rates] matched ${result.matchedCount}/${result.carparks.length} carparks against corpus (${result.corpusSize} entries). Unmatched nearby:`,
    result.unmatchedNames,
  );
}
