import type { AvailabilityStatus, DurationHours } from './types';

export function availabilityStatus(lots: number | null): AvailabilityStatus {
  if (lots == null) return 'unknown';
  if (lots === 0) return 'full';
  if (lots <= 10) return 'limited';
  return 'available';
}

export function availabilityColorVar(status: AvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'var(--ok)';
    case 'limited':
      return 'var(--warn)';
    case 'full':
      return 'var(--bad)';
    default:
      return 'var(--muted-status)';
  }
}

export function availabilityBgVar(status: AvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'var(--ok-bg)';
    case 'limited':
      return 'var(--warn-bg)';
    case 'full':
      return 'var(--bad-bg)';
    default:
      return 'var(--muted-status-bg)';
  }
}

export function durationLabel(v: DurationHours): string {
  if (v === 0.5) return '30 min';
  if (v === 4) return '4 hr+';
  return `${v} hr`;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/** Cost for display, honouring `rateUnknown` (Google carparks have no rate, so
 * we show "—" rather than a fabricated estimate). */
export function formatCostMaybe(
  cp: { rateUnknown?: boolean },
  cost: number,
): string {
  return cp.rateUnknown ? '—' : formatCost(cost);
}

/** Short rate hint for a Google carpark from its coarse free/paid flags. */
export function googleRateHint(parking?: {
  free: boolean | null;
  paid: boolean | null;
}): string {
  if (parking?.free) return 'Free parking';
  if (parking?.paid) return 'Paid · rate unknown';
  return 'Rate unknown';
}

export type LotsDisplay = {
  /** Hero count — the live available lots, or '—' when there's no live count. */
  count: string;
  /**
   * Honest secondary line. Known capacity → "of 1,200 lots"; live count but no
   * known capacity (e.g. an uncurated LTA DataMall lot) → "lots free" rather
   * than a "total unknown" that reads like a pipeline bug; no live data → a
   * plain status.
   */
  secondary: string;
  /** Percent of capacity free (0–100), or null when capacity is unknown. */
  pctFree: number | null;
};

/**
 * Single source of truth for how available/total lots are presented (DATA-1).
 *
 * LTA DataMall reports available lots but no capacity, so many carparks have a
 * live count with no total. Pairing "763" with "total unknown" read as a bug;
 * instead we show the bare count honestly and only compute a percentage when a
 * real capacity exists (URA/HDB live/curated malls/JustPark all carry totals).
 */
export function lotsDisplay(
  lotsAvailable: number | null,
  lotsTotal: number,
  degraded: boolean,
): LotsDisplay {
  if (degraded) return { count: '—', secondary: 'live count updating', pctFree: null };
  if (lotsAvailable == null) return { count: '—', secondary: 'no live count', pctFree: null };
  if (lotsTotal > 0) {
    const pctFree = Math.max(0, Math.min(100, Math.round((lotsAvailable / lotsTotal) * 100)));
    return { count: String(lotsAvailable), secondary: `of ${lotsTotal.toLocaleString()} lots`, pctFree };
  }
  return {
    count: String(lotsAvailable),
    secondary: lotsAvailable === 0 ? 'no lots free' : 'lots free',
    pctFree: null,
  };
}
