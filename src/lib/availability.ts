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
