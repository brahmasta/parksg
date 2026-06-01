import type { Carpark, RateRow, RateSource } from './types';

/**
 * Rate-source attribution for a carpark. A carpark's rate rows are
 * single-source (the curated ingest replaces rows per carpark_id, and the
 * runtime fallbacks only emit HDB/URA/MANUAL — never LTA_DATAGOV), so the first
 * non-empty bucket's first row is representative. Centralised here so the
 * Results card, the CHEAPEST ranking, and the Detail banner all agree.
 */
export function firstRateRow(cp: Carpark): RateRow | null {
  return cp.rates.weekday[0] ?? cp.rates.saturday[0] ?? cp.rates.sundayPH[0] ?? null;
}

export function rateSourceOf(cp: Carpark): RateSource | null {
  return firstRateRow(cp)?.source ?? null;
}

/**
 * True when the displayed price comes from the stale Nov-2018 data.gov.sg LTA
 * snapshot — the one corpus we explicitly flag as outdated. Because rows are
 * single-source and fallbacks never emit LTA_DATAGOV, this can't false-positive
 * on a URA/HDB/MANUAL/curated carpark.
 */
export function isStaleRates(cp: Carpark): boolean {
  return rateSourceOf(cp) === 'LTA_DATAGOV';
}
