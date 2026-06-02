import type { Carpark, DurationHours, ResultsState } from './types';
import { isStaleRates } from './rateSource';

/**
 * Pure ranking + filter-empty classification for the Results screen.
 *
 * Splitting this out of the component does two things:
 *  1. Lets us tell *which* filter emptied the list. With both EV and Available
 *     filters live, a bare `ranked.length === 0` can't say whether to show the
 *     EV empty-state, the Available empty-state, or neither — so the avail
 *     filter silently rendered "0 carparks" with no explanation (the dense-area
 *     Orchard half of BUG-1). We attribute emptiness to the filter that caused
 *     it, applying EV first then Available.
 *  2. Makes the behaviour unit-testable without mounting React.
 *
 * Filters are applied EV → Available so the two empty-states are mutually
 * exclusive: `availFilterEmpty` only fires when EV left a non-empty set that
 * Available then cleared.
 */
export type SortBy = 'cost' | 'distance';

export type ResultsView = {
  /** Carparks after sort + active filters. */
  ranked: Carpark[];
  /** EV filter is on and nothing nearby has a charger. */
  evFilterEmpty: boolean;
  /** Available-only is on and every (EV-passing) carpark is full. */
  availFilterEmpty: boolean;
};

export function selectResultsView(input: {
  carparks: Carpark[];
  state: ResultsState;
  availableOnly: boolean;
  evOnly: boolean;
  /** 'cost' ranks by estimated cost for `duration`; 'distance' by walk metres.
   * Defaults to 'distance' to preserve the original nearest-first behaviour. */
  sortBy?: SortBy;
  /** Duration used when sortBy === 'cost'. Defaults to 1h. */
  duration?: DurationHours;
  /** Optional arbitrary-duration cost (dollars) per carpark — used by the
   * desktop StayPlanner. Returns null when unknown. When omitted, cost falls
   * back to the preset estByHours[duration] (rateUnknown carparks → null). */
  costOf?: (cp: Carpark) => number | null;
}): ResultsView {
  const { carparks, state, availableOnly, evOnly, sortBy = 'distance', duration = 1, costOf } = input;

  // Cost function: explicit costOf when provided, else the preset estimate
  // (rateUnknown → null so it can't masquerade as the cheapest $0).
  const costFn = costOf ?? ((c: Carpark) => (c.rateUnknown ? null : c.estByHours[duration]));

  // Full carparks (0 lots free) always sink to the bottom, regardless of sort;
  // within each group, sort by cost or distance. Unknown costs (null) sink
  // after priced carparks of equal availability.
  const sorted = [...carparks].sort((a, b) => {
    const af = a.lotsAvailable === 0 ? 1 : 0;
    const bf = b.lotsAvailable === 0 ? 1 : 0;
    if (af !== bf) return af - bf;
    if (sortBy === 'cost') {
      const av = costFn(a) ?? Infinity;
      const bv = costFn(b) ?? Infinity;
      if (av !== bv) return av - bv;
    }
    return a.walkMeters - b.walkMeters;
  });
  const afterEv = evOnly ? sorted.filter((c) => c.ev?.hasCharging === true) : sorted;
  const ranked = availableOnly
    ? afterEv.filter((c) => (c.lotsAvailable ?? 0) > 0)
    : afterEv;

  // Only meaningful once a search has actually resolved; 'loading'/'empty'
  // have their own dedicated screens.
  const settled = state === 'loaded' || state === 'degraded';

  const evFilterEmpty = settled && evOnly && afterEv.length === 0;
  const availFilterEmpty =
    settled && availableOnly && afterEv.length > 0 && ranked.length === 0;

  return { ranked, evFilterEmpty, availFilterEmpty };
}

/**
 * Pick the carpark to award the CHEAPEST badge for the chosen duration.
 *
 * A stale 2018 figure must not beat a live, accurate price unchallenged
 * (TRUST-1), so we award the badge among trustworthy (non-stale) carparks
 * first. Only when *every* option is stale — an apples-to-apples comparison
 * where the caveat applies equally to all — do we fall back to the full list.
 * Returns null for an empty list.
 */
export function pickCheapestId(
  ranked: Carpark[],
  duration: DurationHours,
  costOf?: (cp: Carpark) => number | null,
): string | null {
  // Cost function mirrors selectResultsView: explicit costOf, else the preset
  // estimate. rateUnknown / null-cost carparks are excluded outright.
  const costFn = costOf ?? ((c: Carpark) => (c.rateUnknown ? null : c.estByHours[duration]));
  const priced = ranked.filter((c) => costFn(c) != null);
  if (priced.length === 0) return null;
  // The badge marks the genuinely cheapest *available* carpark, independent of
  // the active sort. Prefer carparks with free lots; only if none are available
  // do we fall back to the full set so a badge still shows.
  const available = priced.filter((c) => c.lotsAvailable !== 0);
  const pool = available.length > 0 ? available : priced;
  const fresh = pool.filter((c) => !isStaleRates(c));
  const field = fresh.length > 0 ? fresh : pool;
  return field.reduce((best, c) => ((costFn(c) as number) < (costFn(best) as number) ? c : best), field[0]).id;
}
