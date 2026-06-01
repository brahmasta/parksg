import type { Carpark, ResultsState } from './types';

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
