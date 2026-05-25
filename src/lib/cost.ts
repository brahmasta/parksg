// Cost calculators. None of the upstream APIs return per-carpark rate
// schedules in a way the browser can use directly — HDB tariffs are
// hardcoded by spec, URA's Car_Park_Details endpoint needs a daily
// token rotation (Phase 3), and LTA Datamall's CarParkAvailabilityv2
// stopped returning the Pricing field. Until Phase 3 lands real URA
// rate parsing, URA and LTA carparks use conservative flat estimates.

import type { Carpark, DurationHours, Operator } from './types';

const HDB_RATE_PER_HALF_HOUR = 0.6;
// URA off-street short-term rate, peak weekday daytime — most expensive
// common tier. Real fares are often lower (weekends, evenings, free at
// night). We over-estimate on purpose so users aren't surprised at the gantry.
const URA_PEAK_PER_HALF_HOUR = 1.2;
// LTA / commercial carparks vary wildly. A central-area mall carpark like
// Suntec runs $1.50–$3.00 / 30 min. Use the lower end as a rough estimate.
const LTA_PER_HALF_HOUR = 1.6;

function computeByHours(perHalfHour: number): Carpark['estByHours'] {
  const compute = (hours: DurationHours) => {
    const halfHours = Math.ceil(hours * 2);
    return +(halfHours * perHalfHour).toFixed(2);
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

export function estByHoursFor(operator: Operator): Carpark['estByHours'] {
  switch (operator) {
    case 'HDB':
      return computeByHours(HDB_RATE_PER_HALF_HOUR);
    case 'URA':
      return computeByHours(URA_PEAK_PER_HALF_HOUR);
    case 'LTA':
      return computeByHours(LTA_PER_HALF_HOUR);
  }
}

export function ratesFor(operator: Operator): Carpark['rates'] {
  switch (operator) {
    case 'HDB':
      return {
        weekday: [
          { window: '7am – 10:30pm', rate: '$0.60 / 30 min', source: 'HDB' },
          { window: '10:30pm – 7am', rate: '$2.00 cap', source: 'HDB' },
        ],
        saturday: [
          { window: '7am – 10:30pm', rate: '$0.60 / 30 min', source: 'HDB' },
          { window: '10:30pm – 7am', rate: '$2.00 cap', source: 'HDB' },
        ],
        sundayPH: [{ window: 'All day', rate: '$0.60 / 30 min', source: 'HDB' }],
      };
    case 'URA':
      // URA's off-street rates vary by location. Show the canonical peak
      // weekday rate with a note. Real per-carpark schedules come in Phase 3.
      return {
        weekday: [
          { window: '7am – 5pm', rate: '$1.20 / 30 min', cap: 'varies by carpark', source: 'URA' },
          { window: '5pm – 10pm', rate: '$0.60 / 30 min', source: 'URA' },
          { window: '10pm – 7am', rate: 'Free', source: 'URA' },
        ],
        saturday: [
          { window: '7am – 5pm', rate: '$1.20 / 30 min', source: 'URA' },
          { window: '5pm – 10pm', rate: '$0.60 / 30 min', source: 'URA' },
        ],
        sundayPH: [{ window: 'All day', rate: '$0.60 / 30 min', source: 'URA' }],
      };
    case 'LTA':
      // LTA carparks (often commercial / off-street next to MRT or expressways).
      // Rates are very location-specific; surface a placeholder until Phase 3.
      return {
        weekday: [
          { window: 'Rates vary by operator', rate: '≈ $1.60 / 30 min', source: 'MANUAL' },
        ],
        saturday: [{ window: 'Rates vary by operator', rate: '≈ $1.60 / 30 min', source: 'MANUAL' }],
        sundayPH: [{ window: 'Rates vary by operator', rate: '≈ $1.60 / 30 min', source: 'MANUAL' }],
      };
  }
}

// Re-export the old HDB-specific names for any callers still using them.
export function hdbEstByHours() {
  return estByHoursFor('HDB');
}
export function hdbRates() {
  return ratesFor('HDB');
}
