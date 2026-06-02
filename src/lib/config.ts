// Tunable runtime config, sourced from Vite env vars so values can be changed
// in the deploy environment (e.g. Vercel → Settings → Environment Variables)
// without code edits. A redeploy applies the new value (Vite inlines VITE_*
// vars at build time).

/**
 * Show supplementary Google carparks only when our own DB returns FEWER than
 * this many carparks nearby (gap-fill). Tune via `VITE_GOOGLE_GAP_THRESHOLD`:
 *   - default 5  → fill gaps in sparse areas, stay DB-only where well covered
 *   - a high value (e.g. 999) → effectively always show Google
 *   - 0          → never show Google
 */
export const GOOGLE_GAP_THRESHOLD = parseNonNegativeInt(
  import.meta.env.VITE_GOOGLE_GAP_THRESHOLD,
  5,
);

function parseNonNegativeInt(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
