export type Operator = 'HDB' | 'URA' | 'LTA';
export type LotType = 'C' | 'M' | 'H';

// ── EV charging ──────────────────────────────────────────────────────
export type ConnectorStatus = 'Available' | 'Occupied' | 'Not Available';
export type Current = 'AC' | 'DC';
export type PlugType = 'Type 2' | 'CCS2' | 'CHAdeMO' | 'GB/T';

export type EVConnector = {
  /** Stable id per physical connector — used as a React key. */
  id: string;
  operator: string;
  /** Human-readable position, e.g. "L1 Bay A1". */
  position: string;
  /** "24/7" or "7am–11pm". */
  hours: string;
  plugType: PlugType;
  current: Current;
  kw: number;
  /** SGD, numeric. */
  price: number;
  priceType: '/kWh' | '/h';
  status: ConnectorStatus;
};

export type CarparkEV = {
  hasCharging: boolean;
  /** Age of the LTA snapshot in minutes. >5 → treat feed as stale. */
  lastUpdatedMin?: number;
  /** Distinct operators, ordered by connector count desc. */
  operators?: string[];
  /** Omit when hasCharging is false. */
  connectors?: EVConnector[];
};

export type RateSource =
  | 'URA'
  | 'HDB'
  | 'LTA_DATAGOV'
  | 'LTA_DATAMALL'
  | 'CAG'
  | 'OPERATOR'
  | 'MANUAL';

/** Day bucket a band applies to. Carpark.rates groups by these for display,
 * but each row also carries the value explicitly so flatter shapes (e.g.
 * `RateRow[]` straight off the URA proxy) round-trip without losing
 * information. */
export type DayType = 'WEEKDAY' | 'SAT' | 'SUN_PH';

export type RateSystem = 'EPS' | 'COUPON' | 'GANTRY_PRIVATE' | 'FLAT';
export type VehCat = 'CAR' | 'MOTORCYCLE' | 'HEAVY';

/**
 * A row in a carpark's rate schedule.
 *
 * The cosmetic `window` / `rate` / `cap` fields render the schedule in the
 * UI. They're optional — when omitted, RateTable falls back to the
 * `synthesizeWindow` / `synthesizeRate` helpers in `rateDisplay.ts` which
 * derive readable strings from the structured fields below.
 *
 * The structured fields are populated for sources the cost calculator can
 * reason about (URA, LTA_DATAGOV, …); when present they let estByHours
 * compute a real estimate instead of a flat fallback.
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
  /** Cosmetic — derived if missing. */
  window?: string;
  /** Cosmetic — derived if missing. */
  rate?: string;
  /** Cosmetic — derived if missing. */
  cap?: string;
  // ── Structured fields ──────────────────────────────────────────────
  /** Which day bucket this row applies to. */
  dayType?: DayType;
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
  /** Grace period at entry/exit, in minutes. */
  graceMinutes?: number;
  /** Charging mechanism — EPS gantry, paper coupon, private gantry, flat. */
  system?: RateSystem;
  /** Vehicle category this row priced for. v1 only renders CAR rows. */
  vehCat?: VehCat;
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
  /** EV charging data from LTA /EVCBatch joined by haversine ≤50m. */
  ev?: CarparkEV;
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
export type Screen =
  | 'home'
  | 'results'
  | 'detail'
  | 'about'
  | 'account'
  | 'saved-carparks'
  | 'saved-destinations';
export type ViewMode = 'list' | 'map';

// ── Accounts & Save ─────────────────────────────────────────────────
export type User = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string;
};

export type Session = {
  user: User | null;
  syncedAt: number | null;
};

export type DestIcon =
  | 'briefcase'
  | 'home'
  | 'star'
  | 'heart'
  | 'pin'
  | 'building';

export const DESTINATION_ICONS: DestIcon[] = [
  'briefcase',
  'home',
  'star',
  'heart',
  'pin',
  'building',
];

export type SavedDestination = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  icon: DestIcon;
  createdAt: number;
};
