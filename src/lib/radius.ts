/** Search radii offered in the results header, in metres. */
export const RADIUS_OPTIONS = [300, 600, 1000, 1500, 2000] as const;

export const DEFAULT_RADIUS_M = 600;

/** 600 → "600m", 1000 → "1km", 1500 → "1.5km". */
export function fmtRadius(m: number): string {
  return m < 1000 ? `${m}m` : `${m / 1000}km`;
}

/** The next radius up for "search wider", or null at the largest. */
export function widerRadius(m: number): number | null {
  return RADIUS_OPTIONS.find((r) => r > m) ?? null;
}
