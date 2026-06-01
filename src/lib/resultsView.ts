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
export type ResultsView = {
  /** Carparks after sort + active filters, nearest first. */
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
}): ResultsView {
  const { carparks, state, availableOnly, evOnly } = input;

  const sorted = [...carparks].sort((a, b) => a.walkMeters - b.walkMeters);
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
export function pickCheapestId(ranked: Carpark[], duration: DurationHours): string | null {
  if (ranked.length === 0) return null;
  const fresh = ranked.filter((c) => !isStaleRates(c));
  const field = fresh.length > 0 ? fresh : ranked;
  return field.reduce(
    (best, c) => (c.estByHours[duration] < best.estByHours[duration] ? c : best),
    field[0],
  ).id;
}
