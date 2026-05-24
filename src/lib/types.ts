export type Operator = 'HDB' | 'URA' | 'LTA';
export type LotType = 'C' | 'M' | 'H';

export type RateRow = {
  window: string;
  rate: string;
  cap?: string;
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
