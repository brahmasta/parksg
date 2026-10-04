/**
 * Ranked, priced carparks for the Android Auto screens (api/car/nearby.ts).
 * Pure: the caller fetches the rows and live feeds, so this is unit-tested
 * and uses the same mapping, pricing and ranking as the phone's Results
 * screen (carparkMapping, uraJoin, ev, googleCarpark, stay, resultsView).
 */
import type { Carpark, RateRow } from '../../src/lib/types';
import type { DbCarparkRaw } from '../../src/lib/api/dbCarparks';
import type { HdbAvailability } from '../../src/lib/api/hdb';
import type { LtaCarpark } from '../../src/lib/api/lta';
import type { JustParkLot } from '../../src/lib/api/justpark';
import type { EvLocation } from '../../src/lib/api/ltaEv';
import type { NearbyGooglePlace } from '../../src/lib/api/googlePlaces';
import { buildLiveLotsIndex, buildUraRatesIndex, dbRowToCarpark } from '../../src/lib/carparkMapping';
import { applyUraRates, currentDayType } from '../../src/lib/uraJoin';
import { attachEvData, evSummary } from '../../src/lib/ev';
import { filterNewGooglePlaces, googlePlaceToCarpark } from '../../src/lib/googleCarpark';
import { estCostForStay } from '../../src/lib/stay';
import { selectResultsView } from '../../src/lib/resultsView';
import { synthesizeRate, synthesizeWindow } from '../../src/lib/rateDisplay';

export type CarResultInput = {
  dest: { lat: number; lng: number; label?: string };
  rows: DbCarparkRaw[];
  hdb: Map<string, HdbAvailability> | null;
  lta: LtaCarpark[] | null;
  justpark: JustParkLot[] | null;
  ev: { locations: EvLocation[]; ageMinutes: number } | null;
  google: NearbyGooglePlace[];
  hours: number;
  /** Singapore wall-clock time (see sgWallClock). */
  now: Date;
  limit: number;
};

export type CarCarpark = {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  distanceM: number;
  walkMin: number;
  cost: number | null;
  lotsAvailable: number | null;
  lotsTotal: number | null;
  heightLimitM: number | null;
  evAvailable: number | null;
  evTotal: number | null;
  rateLines: string[];
};

/** "Now" as a Date whose local getters read Singapore time, whatever the
 *  server's time zone (Vercel runs in UTC; tests may run in SGT). */
export function sgWallClock(nowMs: number = Date.now()): Date {
  const offsetMin = new Date(nowMs).getTimezoneOffset(); // UTC → local, inverted
  return new Date(nowMs + (8 * 60 + offsetMin) * 60_000);
}

/** Today's car rate rows as short lines, e.g. "8am – 5pm: $2.00 / 1st hr · $1.50 / 30 min". */
function rateLines(cp: Carpark, now: Date): string[] {
  const day = currentDayType(now);
  const rows: RateRow[] =
    day === 'SAT' ? cp.rates.saturday : day === 'SUN_PH' ? cp.rates.sundayPH : cp.rates.weekday;
  return rows.slice(0, 3).map((r) => `${synthesizeWindow(r)}: ${synthesizeRate(r)}`);
}

export function buildCarResults(input: CarResultInput): CarCarpark[] {
  const { dest, now, hours } = input;
  const dayType = currentDayType(now);
  const lots = buildLiveLotsIndex(input.hdb, input.lta, input.justpark);

  let carparks = input.rows
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => dbRowToCarpark(r, dest, lots, dayType, now.getHours()))
    .sort((a, b) => a.walkMeters - b.walkMeters);
  carparks = applyUraRates(carparks, buildUraRatesIndex(input.rows), now).carparks;
  if (input.ev) carparks = attachEvData(carparks, input.ev.locations, input.ev.ageMinutes);
  if (input.google.length) {
    const extra = filterNewGooglePlaces(input.google.map((p) => googlePlaceToCarpark(p, dest)), carparks);
    carparks = [...carparks, ...extra].sort((a, b) => a.walkMeters - b.walkMeters);
  }

  const stay = { startMode: 'later' as const, startAt: now, hours };
  const costOf = (cp: Carpark) => estCostForStay(cp, stay);
  const { ranked } = selectResultsView({
    carparks,
    state: 'loaded',
    availableOnly: false,
    evOnly: false,
    sortBy: 'cost',
    costOf,
    destinationLabel: dest.label,
  });

  return ranked.slice(0, input.limit).map((cp) => {
    const ev = evSummary(cp.ev);
    return {
      id: cp.id,
      name: cp.name,
      subtitle: cp.block,
      lat: cp.coords.entrance[0],
      lng: cp.coords.entrance[1],
      distanceM: cp.walkMeters,
      walkMin: cp.walkMin,
      cost: costOf(cp),
      lotsAvailable: cp.lotsAvailable,
      lotsTotal: cp.lotsTotal > 0 ? cp.lotsTotal : null,
      heightLimitM: cp.heightLimitM ?? null,
      evAvailable: ev ? ev.available : null,
      evTotal: ev ? ev.total : null,
      rateLines: cp.rateUnknown ? [] : rateLines(cp, now),
    };
  });
}
