// Placeholder cost for carparks whose rate we don't know.
//
// We never fabricate a rate: a carpark with no usable rate rows (and every
// Google supplementary carpark) is flagged `rateUnknown`, renders "—" /
// "Rate unknown", and is left out of the cheapest ranking. `estByHours` stays
// non-optional on Carpark, so those carparks carry these sentinel zeros, which
// every cost render site guards on `rateUnknown` before showing.

import type { Carpark } from './types';

export const UNKNOWN_EST_BY_HOURS: Readonly<Carpark['estByHours']> = Object.freeze({
  0.5: 0,
  1: 0,
  1.5: 0,
  2: 0,
  3: 0,
  4: 0,
});
