// HDB tariff cost calculator. The HDB carpark tariff isn't returned by any
// API — it's a published flat schedule. Standard HDB carparks charge $0.60
// per 30-minute block from 7am to 10:30pm and a $2.00 overnight cap.
// "Central area" carparks charge $1.20 / 30 min during peak hours, but those
// are a small minority and are deferred until we ship URA/LTA in Phase 2.
//
// `estByHours` matches the shape the UI already consumes from mockData.

import type { Carpark, DurationHours } from './types';

const HDB_RATE_PER_HALF_HOUR = 0.6;

export function hdbEstByHours(): Carpark['estByHours'] {
  const compute = (hours: DurationHours) => {
    const halfHours = Math.ceil(hours * 2);
    return +(halfHours * HDB_RATE_PER_HALF_HOUR).toFixed(2);
  };
  return {
    0.5: compute(0.5),
    1: compute(1),
    1.5: compute(1.5),
    2: compute(2),
    3: compute(3),
    4: compute(4),
  };
}

export function hdbRates(): Carpark['rates'] {
  return {
    weekday: [
      { window: '7am – 10:30pm', rate: '$0.60 / 30 min' },
      { window: '10:30pm – 7am', rate: '$2.00 cap' },
    ],
    saturday: [
      { window: '7am – 10:30pm', rate: '$0.60 / 30 min' },
      { window: '10:30pm – 7am', rate: '$2.00 cap' },
    ],
    sundayPH: [{ window: 'All day', rate: '$0.60 / 30 min' }],
  };
}
