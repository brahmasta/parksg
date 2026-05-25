import type { RateRow } from './types';

/**
 * Estimate the total cost (in cents) of parking for `hours` using the
 * structured fields on a RateRow[]. Used by the runtime to rank corpus
 * carparks alongside HDB/URA, and re-used by the ingestion script's
 * unit tests.
 *
 * The function is intentionally simple — the underlying corpus has many
 * edge cases (holiday surcharges, multi-tier blocks with different sizes
 * per tier, etc.) that a small carpark-finder UI doesn't need to model
 * exactly. We over-estimate slightly so users aren't surprised at the
 * gantry.
 *
 * Returns null when no row carries enough structured info to estimate.
 */
export function estimateCostCents(rows: RateRow[], hours: number): number | null {
  if (rows.length === 0) return null;
  const row =
    rows.find(
      (r) =>
        r.perBlockCents != null ||
        r.perEntryCents != null ||
        r.firstHourCents != null,
    ) ?? rows[0];

  let cents = 0;
  if (row.perEntryCents != null && row.perBlockCents == null && row.firstHourCents == null) {
    cents = row.perEntryCents;
  } else if (row.perBlockCents != null && row.blockMinutes != null) {
    const totalMinutes = Math.ceil(hours * 60);
    if (row.firstHourCents != null) {
      const firstBlockMin = row.firstBlockMinutes ?? 60;
      cents += row.firstHourCents;
      const remain = Math.max(0, totalMinutes - firstBlockMin);
      cents += Math.ceil(remain / row.blockMinutes) * row.perBlockCents;
    } else {
      cents += Math.ceil(totalMinutes / row.blockMinutes) * row.perBlockCents;
    }
  } else if (row.firstHourCents != null) {
    // First-tier-only row — extrapolate per tier-block for longer stays.
    const firstBlockMin = row.firstBlockMinutes ?? 60;
    const tiers = Math.max(1, Math.ceil((hours * 60) / firstBlockMin));
    cents = row.firstHourCents * tiers;
  } else {
    return null;
  }

  if (row.capCents != null && cents > row.capCents) cents = row.capCents;
  return cents;
}
