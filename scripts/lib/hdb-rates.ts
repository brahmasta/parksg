/**
 * HDB rate rule engine — pure function.
 *
 * Given a single HDB carpark's identity + the raw HDB Carpark Information
 * payload + the two curated reference lists, returns the list of RateRow
 * shapes to insert into Supabase. No I/O, no DB — testable in isolation.
 *
 * Rules encoded (per HDB Short Term Parking Charges):
 *   - Non-Central:  $0.60 / 30 min   day cap $12     night cap $5
 *   - Central:      $1.20 / 30 min   day cap $20     night cap $5
 *   - EPS only:     15-minute grace at entry
 *   - Coupon:       whole 30-min blocks. NO grace, NO cap, never night-coupon.
 *   - Day band:     07:00 – 22:30   (matches HDB's posted hours)
 *   - Night band:   22:30 – 07:00   (only emitted when night parking is offered)
 *   - Night cap:    $5 at participating EPS carparks
 *   - raw.night_parking === "NO" → no night row at all
 *   - Peak-restructured carparks (post-2022 Central hike): emit MANUAL rows
 *     from the override file and DISABLE the cap. Empty override list →
 *     fall through to the standard Central treatment.
 */

import type { DayType, ParkingSystem, Source, VehCat } from './hdb-rates.types';

export type HdbRawPayload = {
  car_park_no?: string;
  address?: string;
  type_of_parking_system?: string;
  free_parking?: string;
  night_parking?: string;
  short_term_parking?: string;
};

export type HdbRuleInput = {
  carparkId: string; // "HDB:U45"
  parkingSystem: ParkingSystem; // 'EPS' | 'COUPON' (others ignored upstream)
  centralArea: boolean;
  raw: HdbRawPayload | null | undefined;
  /** From hdb-peak-restructured-codes.json. Stub-empty today. */
  peakRestructuredCodes: Set<string>;
  /** From hdb-peak-restructured-codes.json. Looks up the carpark's MANUAL bands. */
  peakBands?: PeakBand[];
  /** ISO date for the effective_from stamp. */
  effectiveFrom: string;
};

/** Shape pulled from the override file once we curate it. */
export type PeakBand = {
  /** Day-of-week bucket the band applies to. */
  dayType: DayType;
  /** 'HH:mm:ss' start, inclusive. */
  startTime: string;
  /** 'HH:mm:ss' end, exclusive. */
  endTime: string;
  perBlockCents: number;
  blockMinutes: number;
};

export type HdbRateRow = {
  carpark_id: string;
  day_type: DayType;
  start_time: string | null;
  end_time: string | null;
  per_block_cents: number;
  block_minutes: number;
  first_hour_cents: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: ParkingSystem;
  veh_cat: VehCat;
  source: Source;
  effective_from: string | null;
};

const DAY_TYPES: DayType[] = ['WEEKDAY', 'SAT', 'SUN_PH'];

const DAY_START = '07:00:00';
const DAY_END = '22:30:00';
const NIGHT_START = '22:30:00';
const NIGHT_END = '07:00:00'; // wraps midnight — runtime estimator handles this

const CENTRAL_PER_BLOCK_CENTS = 120;
const NON_CENTRAL_PER_BLOCK_CENTS = 60;
const BLOCK_MINUTES = 30;
const CENTRAL_DAY_CAP_CENTS = 2000;
const NON_CENTRAL_DAY_CAP_CENTS = 1200;
const NIGHT_CAP_CENTS = 500;
const EPS_GRACE_MINUTES = 15;

export function inferHdbRateRows(input: HdbRuleInput): HdbRateRow[] {
  const {
    carparkId,
    parkingSystem,
    centralArea,
    raw,
    peakRestructuredCodes,
    peakBands,
    effectiveFrom,
  } = input;

  // Coupon carparks are simple: 1 day row per day_type, no cap, no grace, no night.
  if (parkingSystem === 'COUPON') {
    return DAY_TYPES.map((day) => ({
      carpark_id: carparkId,
      day_type: day,
      start_time: DAY_START,
      end_time: DAY_END,
      per_block_cents: centralArea ? CENTRAL_PER_BLOCK_CENTS : NON_CENTRAL_PER_BLOCK_CENTS,
      block_minutes: BLOCK_MINUTES,
      first_hour_cents: null,
      per_entry_cents: null,
      cap_cents: null,
      grace_minutes: null,
      system: 'COUPON',
      veh_cat: 'CAR',
      source: 'HDB',
      effective_from: effectiveFrom,
    }));
  }

  // EPS — Peak-restructured Central: emit MANUAL bands, cap disabled.
  const code = carparkId.replace(/^HDB:/, '');
  if (
    centralArea &&
    peakRestructuredCodes.has(code) &&
    peakBands &&
    peakBands.length > 0
  ) {
    return peakBands.map<HdbRateRow>((b) => ({
      carpark_id: carparkId,
      day_type: b.dayType,
      start_time: b.startTime,
      end_time: b.endTime,
      per_block_cents: b.perBlockCents,
      block_minutes: b.blockMinutes,
      first_hour_cents: null,
      per_entry_cents: null,
      cap_cents: null, // explicitly disabled per HDB
      grace_minutes: EPS_GRACE_MINUTES,
      system: 'EPS',
      veh_cat: 'CAR',
      source: 'MANUAL',
      effective_from: effectiveFrom,
    }));
  }

  // EPS — standard tier (Central or non-Central).
  const perBlock = centralArea ? CENTRAL_PER_BLOCK_CENTS : NON_CENTRAL_PER_BLOCK_CENTS;
  const dayCap = centralArea ? CENTRAL_DAY_CAP_CENTS : NON_CENTRAL_DAY_CAP_CENTS;

  const dayRows: HdbRateRow[] = DAY_TYPES.map((day) => ({
    carpark_id: carparkId,
    day_type: day,
    start_time: DAY_START,
    end_time: DAY_END,
    per_block_cents: perBlock,
    block_minutes: BLOCK_MINUTES,
    first_hour_cents: null,
    per_entry_cents: null,
    cap_cents: dayCap,
    grace_minutes: EPS_GRACE_MINUTES,
    system: 'EPS',
    veh_cat: 'CAR',
    source: 'HDB',
    effective_from: effectiveFrom,
  }));

  // Night rows — only at carparks that explicitly offer night parking.
  // raw.night_parking is "YES"/"NO" in the data.gov.sg payload; default to
  // YES when missing because most carparks offer it.
  const nightFlag = (raw?.night_parking ?? 'YES').toUpperCase();
  if (nightFlag === 'NO') return dayRows;

  const nightRows: HdbRateRow[] = DAY_TYPES.map((day) => ({
    carpark_id: carparkId,
    day_type: day,
    start_time: NIGHT_START,
    end_time: NIGHT_END,
    per_block_cents: perBlock,
    block_minutes: BLOCK_MINUTES,
    first_hour_cents: null,
    per_entry_cents: null,
    cap_cents: NIGHT_CAP_CENTS,
    grace_minutes: EPS_GRACE_MINUTES,
    system: 'EPS',
    veh_cat: 'CAR',
    source: 'HDB',
    effective_from: effectiveFrom,
  }));

  return [...dayRows, ...nightRows];
}
