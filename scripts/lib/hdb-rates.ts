/**
 * HDB rate rule engine — pure function.
 *
 * Given a single HDB carpark's identity + the raw HDB Carpark Information
 * payload + the two curated reference lists, returns the list of RateRow
 * shapes to insert into Supabase. No I/O, no DB — testable in isolation.
 *
 * Rules encoded (per HDB Short Term Parking Charges, verified 2024-05 capture
 * of hdb.gov.sg/car-parks/short-term-parking/short-term-parking-charges):
 *   - Base rate:    $0.60 / 30 min   everywhere and at all times, EXCEPT…
 *   - Central peak: $1.20 / 30 min   ONLY at the 16 enumerated Central-Area
 *                   carparks, and ONLY Mon–Sat 07:00–17:00. Outside that band
 *                   (evenings, Sundays, public holidays, nights) Central
 *                   carparks revert to the $0.60 base rate.
 *   - Day cap:      $12 non-Central / $20 Central, over the 07:00–22:30 window
 *   - Night band:   22:30 – 07:00   (only emitted when night parking is offered)
 *   - Night rate:   $0.60 / 30 min everywhere (the Central premium is daytime-
 *                   only) with a $5 night cap at participating carparks
 *   - EPS only:     15-minute grace at entry; per-minute proration + caps
 *   - Coupon:       whole 30-min blocks, same band structure, NO grace, NO cap,
 *                   never night-coupon
 *   - raw.night_parking === "NO" → no night row at all
 *   - Peak-restructured branch: HDB has NO general short-term peak/time-of-day
 *     restructuring for normal car lots (the only time-differentiated scheme is
 *     Loading/Unloading Bay pricing, which this app does not model). The override
 *     file stays empty; this branch is dormant infrastructure kept for the day
 *     such a list ever materialises. Empty override → standard treatment.
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
const CENTRAL_PEAK_END = '17:00:00'; // $1.20 applies 07:00–17:00 Mon–Sat only
const NIGHT_START = '22:30:00';
const NIGHT_END = '07:00:00'; // wraps midnight — runtime estimator handles this

const CENTRAL_PEAK_PER_BLOCK_CENTS = 120; // $1.20/30min — Central, Mon–Sat 07:00–17:00
const BASE_PER_BLOCK_CENTS = 60; // $0.60/30min — everywhere/everywhen else
const BLOCK_MINUTES = 30;
const CENTRAL_DAY_CAP_CENTS = 2000;
const NON_CENTRAL_DAY_CAP_CENTS = 1200;
const NIGHT_CAP_CENTS = 500;
const EPS_GRACE_MINUTES = 15;

/** Day-band segments for a given day-type + tier. Central carparks charge the
 * $1.20 peak rate only Mon–Sat 07:00–17:00, then drop to the $0.60 base for the
 * rest of the day band; on Sun/PH they are $0.60 all day. Everyone else is a
 * single flat $0.60 band. */
function dayBands(
  dayType: DayType,
  centralArea: boolean,
): Array<{ start: string; end: string; perBlock: number }> {
  if (centralArea && dayType !== 'SUN_PH') {
    return [
      { start: DAY_START, end: CENTRAL_PEAK_END, perBlock: CENTRAL_PEAK_PER_BLOCK_CENTS },
      { start: CENTRAL_PEAK_END, end: DAY_END, perBlock: BASE_PER_BLOCK_CENTS },
    ];
  }
  return [{ start: DAY_START, end: DAY_END, perBlock: BASE_PER_BLOCK_CENTS }];
}

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

  // Coupon carparks: same band structure (incl. the Central Mon–Sat peak split),
  // but no cap, no grace, no night.
  if (parkingSystem === 'COUPON') {
    return DAY_TYPES.flatMap((day) =>
      dayBands(day, centralArea).map<HdbRateRow>((b) => ({
        carpark_id: carparkId,
        day_type: day,
        start_time: b.start,
        end_time: b.end,
        per_block_cents: b.perBlock,
        block_minutes: BLOCK_MINUTES,
        first_hour_cents: null,
        per_entry_cents: null,
        cap_cents: null,
        grace_minutes: null,
        system: 'COUPON',
        veh_cat: 'CAR',
        source: 'HDB',
        effective_from: effectiveFrom,
      })),
    );
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

  // EPS — standard tier (Central or non-Central). Central carparks get a
  // peak/off-peak split on Mon–Sat (see dayBands); everyone else is one flat band.
  const dayCap = centralArea ? CENTRAL_DAY_CAP_CENTS : NON_CENTRAL_DAY_CAP_CENTS;

  const dayRows: HdbRateRow[] = DAY_TYPES.flatMap((day) =>
    dayBands(day, centralArea).map<HdbRateRow>((b) => ({
      carpark_id: carparkId,
      day_type: day,
      start_time: b.start,
      end_time: b.end,
      per_block_cents: b.perBlock,
      block_minutes: BLOCK_MINUTES,
      first_hour_cents: null,
      per_entry_cents: null,
      cap_cents: dayCap,
      grace_minutes: EPS_GRACE_MINUTES,
      system: 'EPS',
      veh_cat: 'CAR',
      source: 'HDB',
      effective_from: effectiveFrom,
    })),
  );

  // Night rows — only at carparks that explicitly offer night parking.
  // raw.night_parking is "YES"/"NO" in the data.gov.sg payload; default to
  // YES when missing because most carparks offer it. The Central premium is
  // daytime-only, so night is always the $0.60 base rate.
  const nightFlag = (raw?.night_parking ?? 'YES').toUpperCase();
  if (nightFlag === 'NO') return dayRows;

  const nightRows: HdbRateRow[] = DAY_TYPES.map((day) => ({
    carpark_id: carparkId,
    day_type: day,
    start_time: NIGHT_START,
    end_time: NIGHT_END,
    per_block_cents: BASE_PER_BLOCK_CENTS,
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
