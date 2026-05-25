/**
 * URA Data Service rates → carpark spine join.
 *
 * The LTA Datamall spine wraps URA carparks with id `ura:<ppCode>`
 * (e.g. `ura:M0078`) and operator `'URA'`. URA's Car_Park_Details
 * proxy returns the same ppCode in raw rows. Match is straight by id —
 * no fuzzy name lookup needed.
 *
 * Replaces `cp.rates` and recomputes `cp.estByHours` from the structured
 * rows. URA-matched carparks become the most authoritative rate source
 * we have for that carpark; non-matched URA carparks keep whatever was
 * set previously (corpus, or the cost.ts flat fallback).
 */

import type { Carpark, DurationHours } from './types';
import { estimateCostCentsAt } from './rateMath';
import type { UraCarparkRates } from './ura';

const DURATION_VALUES: DurationHours[] = [0.5, 1, 1.5, 2, 3, 4];

export function applyUraRates(
  carparks: Carpark[],
  uraByPpCode: Map<string, UraCarparkRates>,
): {
  carparks: Carpark[];
  matchedCount: number;
  unmatchedUraIds: string[];
} {
  if (uraByPpCode.size === 0) {
    return { carparks, matchedCount: 0, unmatchedUraIds: [] };
  }

  const unmatched: string[] = [];
  let matchedCount = 0;

  const now = new Date();
  const dayType = currentDayType(now);
  const hourOfDay = now.getHours();

  const out = carparks.map((cp) => {
    if (cp.operator !== 'URA') return cp;
    const ppCode = cp.id.replace(/^ura:/, '');
    const hit = uraByPpCode.get(ppCode);
    if (!hit) {
      unmatched.push(ppCode);
      return cp;
    }
    matchedCount += 1;

    // Combine all bands into the cost-estimate input. The estimator picks
    // the dominant band that covers the user's day/time.
    const allRows = [...hit.weekday, ...hit.saturday, ...hit.sundayPH];

    const estByHours: Partial<Record<DurationHours, number>> = {};
    let allEstimatesOk = true;
    for (const d of DURATION_VALUES) {
      const cents = estimateCostCentsAt(allRows, d, { dayType, hourOfDay });
      if (cents == null) {
        allEstimatesOk = false;
        break;
      }
      estByHours[d] = +(cents / 100).toFixed(2);
    }

    return {
      ...cp,
      rates: {
        weekday: hit.weekday,
        saturday: hit.saturday,
        sundayPH: hit.sundayPH,
      },
      // Only swap the estimate when every duration computed cleanly —
      // otherwise the original fallback is safer than a mixed-source table.
      estByHours: allEstimatesOk ? (estByHours as Carpark['estByHours']) : cp.estByHours,
      // URA reports total lots accurately; update if the spine had 0.
      lotsTotal: cp.lotsTotal > 0 ? cp.lotsTotal : hit.parkCapacity,
    };
  });

  return { carparks: out, matchedCount, unmatchedUraIds: unmatched };
}

/** Pick today's day bucket. v1 has no public-holiday calendar — Sunday
 * maps to SUN_PH, every other weekday to WEEKDAY, Saturday to SAT. */
export function currentDayType(d: Date): 'WEEKDAY' | 'SAT' | 'SUN_PH' {
  const day = d.getDay();
  if (day === 0) return 'SUN_PH'; // Sunday
  if (day === 6) return 'SAT';
  return 'WEEKDAY';
}

/** Dev-only console log. Mirrors logCoverage in ltaRatesLookup. */
export function logUraCoverage(
  matchedCount: number,
  uraTotal: number,
  unmatchedNearby: string[],
): void {
  if (!import.meta.env.DEV) return;
  if (matchedCount === 0 && unmatchedNearby.length === 0) return;
  // eslint-disable-next-line no-console
  console.debug(
    `[ura] matched ${matchedCount}/${unmatchedNearby.length + matchedCount} nearby URA carparks against the Data Service (${uraTotal} carparks live).${
      unmatchedNearby.length > 0
        ? ` Unmatched ppCodes: ${unmatchedNearby.join(', ')}`
        : ''
    }`,
  );
}
