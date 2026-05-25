export type Operator = 'HDB' | 'URA' | 'LTA';
export type LotType = 'C' | 'M' | 'H';

export type RateSource = 'URA' | 'HDB' | 'LTA_DATAGOV' | 'MANUAL';

/**
 * A row in a carpark's rate schedule.
 *
 * The cosmetic `window` / `rate` / `cap` fields render the schedule in the
 * UI. The structured fields below are populated for sources the cost
 * calculator can reason about (currently LTA_DATAGOV); when present they
 * let estByHours compute a real estimate instead of a flat fallback.
 *
 * Time bands use 'HH:mm' (24h). `endTime` may be lexically less than
 * `startTime` to express crossing midnight, e.g. "18:00"–"03:30".
 *
 * Within one structured row a per-block schedule sets BOTH `perBlockCents`
 * and `blockMinutes` (and may also set `firstHourCents` for a tiered first
 * hour and `capCents` for a cap). A per-entry row sets `perEntryCents`. A
 * "free" or "varies" row may have none of the structured fields — the cost
 * calculator treats that band as zero contribution.
 */
export type RateRow = {
  window: string;
  rate: string;
  cap?: string;
  // ── Structured fields ──────────────────────────────────────────────
  /** 'HH:mm' 24h start of the band, inclusive. */
  startTime?: string;
  /** 'HH:mm' 24h end of the band, exclusive. May be < startTime to express crossing midnight. */
  endTime?: string;
  /** Cents charged for the first tier of a tiered schedule. */
  firstHourCents?: number;
  /** Duration of the first tier in minutes. Defaults to 60 when omitted. */
  firstBlockMinutes?: number;
  /** Cents per `blockMinutes`-minute block after the first hour. */
  perBlockCents?: number;
  /** Block size in minutes for `perBlockCents`. */
  blockMinutes?: number;
  /** Flat per-entry charge, in cents. */
  perEntryCents?: number;
  /** Daily / session cap in cents. */
  capCents?: number;
  /** Where this row came from — drives "rates may be outdated" hints. */
  source: RateSource;
  /** ISO date the source data was effective (e.g. '2018-11-01'). */
  effectiveFrom?: string;
};

export type DurationHours = 0.5 | 1 | 1.5 | 2 | 3 | 4;

export type Carpark = {
  id: string;
  name: string;
  block: string;
  operator: Operator;
  lotTypes: LotType[];
  lotsAvailable: number;
  lotsTotal: number;
  walkMin: number;
  walkMeters: number;
  grace: number;
  coords: { entrance: [number, number] };
  rates: {
    weekday: RateRow[];
    saturday: RateRow[];
    sundayPH: RateRow[];
  };
  estByHours: Record<DurationHours, number>;
};

export type Destination = {
  label: string;
  address: string;
  area: string;
};

export type RecentDestination = {
  name: string;
  hint: string;
  // Resolved coords from the original search. Optional so older entries
  // (and the seeded list) still work — the caller falls back to a text
  // search when these are missing.
  lat?: number;
  lng?: number;
  address?: string;
};

export type DurationOption = { value: DurationHours; label: string };

export type AvailabilityStatus = 'available' | 'limited' | 'full' | 'unknown';
export type ResultsState = 'loading' | 'loaded' | 'degraded' | 'empty';
export type Screen = 'home' | 'results' | 'detail';
export type ViewMode = 'list' | 'map';
