/** Shared types + helpers for the editable rate grid (RateGridEditor.tsx).
 * Kept separate from the component so the component file only exports a
 * component (react-refresh / fast-refresh requirement). */

export type EditableRate = {
  day_type: 'WEEKDAY' | 'SAT' | 'SUN_PH';
  start_time: string | null;
  end_time: string | null;
  first_hour_cents: number | null;
  per_block_cents: number | null;
  block_minutes: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: string;
};

export const DAY_TYPES = ['WEEKDAY', 'SAT', 'SUN_PH'];
export const RATE_SYSTEMS = ['EPS', 'COUPON', 'GANTRY_PRIVATE', 'FLAT'];

export const toDollar = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));
export const toCents = (s: string): number | null => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
};
export const toIntOrNull = (s: string): number | null => {
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : null;
};

/** A blank weekday EPS row with the editable fields populated. */
export function blankEditableRate(): EditableRate {
  return {
    day_type: 'WEEKDAY', start_time: null, end_time: null,
    first_hour_cents: null, per_block_cents: null, block_minutes: 30,
    per_entry_cents: null, cap_cents: null, grace_minutes: null, system: 'EPS',
  };
}
