/**
 * Outcome summary for one resolved search, logged on `results_viewed` so the
 * weekly review can rank destinations where users get few or unpriced results
 * (search_events stores the query but not the outcome; results_viewed used to
 * store a count but not the query).
 *
 * Counts only — no carpark ids, no coordinates, nothing personal beyond the
 * destination label search_events already stores.
 */
import type { Carpark } from './types';

export type ResultsQuality = {
  /** Every carpark shown. */
  count: number;
  /** Carparks priced from their own rate rows. */
  priced: number;
  /** Our own carparks with no usable rate rows (shown as "Rate unknown").
   * Key kept as `estimated` so the logged results_viewed property stays
   * comparable with events from before these stopped getting a placeholder. */
  estimated: number;
  /** Supplementary Google carparks (no rate at all). */
  unknown: number;
};

export function resultsQuality(carparks: Carpark[]): ResultsQuality {
  let unknown = 0;
  let estimated = 0;
  for (const cp of carparks) {
    if (cp.rateMissing) estimated++;
    else if (cp.rateUnknown) unknown++;
  }
  return { count: carparks.length, priced: carparks.length - unknown - estimated, estimated, unknown };
}

/** Longest destination label logged with an event; app_events caps props at
 *  2,000 characters and search_events truncates queries at 200. */
export const QUERY_MAX = 120;
