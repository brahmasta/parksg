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
  /** Carparks on the operator-default placeholder estimate (no rate rows). */
  estimated: number;
  /** Carparks with no rate at all (supplementary Google results). */
  unknown: number;
};

export function resultsQuality(carparks: Carpark[]): ResultsQuality {
  let unknown = 0;
  let estimated = 0;
  for (const cp of carparks) {
    if (cp.rateUnknown) unknown++;
    else if (cp.rateEstimated) estimated++;
  }
  return { count: carparks.length, priced: carparks.length - unknown - estimated, estimated, unknown };
}

/** Longest destination label logged with an event; app_events caps props at
 *  2,000 characters and search_events truncates queries at 200. */
export const QUERY_MAX = 120;
