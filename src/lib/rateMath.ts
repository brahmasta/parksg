import type { DayType, RateRow } from './types';

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

/**
 * Day + time-of-day-aware variant, with cross-band cost stitching.
 *
 * Walks the stay minute-window block by block starting at `hourOfDay`. For
 * each block it looks up the rate band covering that block's *start* time
 * (within the matching `dayType`) and charges that band's per-block rate, so
 * a stay that spans peak + off-peak pays each portion at its real rate
 * instead of the entry band's rate for the whole duration. Example: an HDB
 * Central stay 16:00 → 18:00 now bills $1.20/30min only until 17:00 then
 * $0.60/30min after, rather than $1.20 for all 2h.
 *
 * Caps are session-scoped, not per-band: HDB's $12/$20 *day* cap is attached
 * to both the peak and off-peak rows (cap_cents is equal on both — together
 * they are the one 07:00–22:30 session), while the $5 night cap sits on the
 * night row. We therefore group accumulated charges by their cap value and
 * apply each distinct cap once to its group's subtotal. A 12h Central stay
 * accumulating $19.20 peak + $4.80 off-peak is one $24.00 day-session subtotal
 * capped at $20 — not two separately-capped bands.
 *
 * Reduces exactly to the old single-dominant-band behaviour when the matching
 * rows have no time bands (one all-day band is picked for every block).
 *
 * Falls back to `estimateCostCents(rows, hours)` when no row matches the day,
 * or when nothing in the window could be priced — better something
 * approximate than null.
 */
export function estimateCostCentsAt(
  rows: RateRow[],
  hours: number,
  at: { dayType: DayType; hourOfDay: number },
): number | null {
  if (rows.length === 0) return null;
  const inDay = rows.filter((r) => r.dayType == null || r.dayType === at.dayType);
  if (inDay.length === 0) return estimateCostCents(rows, hours);

  const totalMinutes = Math.ceil(hours * 60);
  let cursor = at.hourOfDay * 60; // minutes from midnight; may pass 1440 overnight
  let remaining = totalMinutes;
  let firstTierCharged = false;

  // Group accumulated cents by cap value so a shared session cap (e.g. HDB's
  // day cap on both the peak and off-peak rows) is applied once to the whole
  // session subtotal. Key '∅' = rows with no cap (summed uncapped).
  const groups = new Map<string, { cents: number; cap: number | null }>();
  const addCharge = (cents: number, cap: number | null) => {
    const key = cap == null ? '∅' : String(cap);
    const g = groups.get(key) ?? { cents: 0, cap };
    g.cents += cents;
    groups.set(key, g);
  };

  let safety = 0;
  while (remaining > 0 && safety++ < 100_000) {
    const tod = ((cursor % 1440) + 1440) % 1440;
    const band = pickDominantCovering(inDay, tod) ?? pickDominant(inDay);
    if (!band) break;

    // Flat per-entry row (no per-block / first-hour): one charge for the stay.
    if (
      band.perEntryCents != null &&
      band.perBlockCents == null &&
      band.firstHourCents == null
    ) {
      addCharge(band.perEntryCents, band.capCents ?? null);
      break;
    }

    // First tier (e.g. "first hour $X"), charged once at the entry band.
    if (!firstTierCharged && band.firstHourCents != null) {
      const firstBlock = band.firstBlockMinutes ?? 60;
      addCharge(band.firstHourCents, band.capCents ?? null);
      cursor += firstBlock;
      remaining -= firstBlock;
      firstTierCharged = true;
      continue;
    }

    // Per-block rate.
    if (band.perBlockCents != null && band.blockMinutes != null && band.blockMinutes > 0) {
      addCharge(band.perBlockCents, band.capCents ?? null);
      cursor += band.blockMinutes;
      remaining -= band.blockMinutes;
      firstTierCharged = true;
      continue;
    }

    // First-tier-only row (no per-block): extrapolate the tier across the stay.
    if (band.firstHourCents != null) {
      const firstBlock = band.firstBlockMinutes ?? 60;
      addCharge(band.firstHourCents, band.capCents ?? null);
      cursor += firstBlock;
      remaining -= firstBlock;
      firstTierCharged = true;
      continue;
    }

    break; // band carries no priceable figure
  }

  if (groups.size === 0) return estimateCostCents(rows, hours);

  let total = 0;
  for (const { cents, cap } of groups.values()) {
    total += cap != null && cents > cap ? cap : cents;
  }
  return total;
}

/** Highest cost-per-minute row whose band covers `tod` (minutes from midnight). */
function pickDominantCovering(rows: RateRow[], tod: number): RateRow | null {
  const covering = rows.filter((r) => bandCoversMinute(r, tod));
  return pickDominant(covering);
}

/** Highest cost-per-minute row overall (the non-cap "real" rate; see costPerMinute). */
function pickDominant(rows: RateRow[]): RateRow | null {
  if (rows.length === 0) return null;
  // Dominant-band heuristic: highest cost-per-minute wins. URA encodes some
  // night caps as a row like "$5.00 / 510 mins" right next to the "$0.60 /
  // 30 mins" rate row; sorting by perBlockCents alone would pick the cap
  // (wrong — it's the daily ceiling, not the per-block rate). Per-minute math
  // correctly puts $0.60/30min (2.0 ¢/min) above $5/510min (~0.98 ¢/min).
  return [...rows].sort((a, b) => costPerMinute(b) - costPerMinute(a))[0];
}

function costPerMinute(r: RateRow): number {
  if (r.perBlockCents != null && r.blockMinutes != null && r.blockMinutes > 0) {
    return r.perBlockCents / r.blockMinutes;
  }
  if (r.firstHourCents != null) {
    const min = r.firstBlockMinutes ?? 60;
    return min > 0 ? r.firstHourCents / min : 0;
  }
  if (r.perEntryCents != null) return r.perEntryCents / 60; // amortise per hour
  return 0;
}

/** True when (startTime <= tod < endTime) in minutes-from-midnight, with
 * wrap-around at midnight. Undefined start/end means "all day". */
function bandCoversMinute(row: RateRow, tod: number): boolean {
  const start = parseMinutes(row.startTime);
  const end = parseMinutes(row.endTime);
  if (start == null || end == null) return true;
  if (start <= end) {
    return tod >= start && tod < end;
  }
  // Crosses midnight, e.g. 22:30 → 07:00 → covers 1350..1439 + 0..419.
  return tod >= start || tod < end;
}

function parseMinutes(hhmm: string | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}
