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
 * Day + time-of-day-aware variant.
 *
 * Filters `rows` to those whose `dayType` matches and whose time band
 * (startTime, endTime) covers `hourOfDay`. From the matching rows, picks
 * the one with the highest `perBlockCents` (dominant-band heuristic) and
 * delegates to `estimateCostCents`. A row with no startTime/endTime is
 * treated as applying all day.
 *
 * v1 deliberately does NOT stitch costs across bands — a long stay that
 * spans peak + off-peak pays the peak rate for the whole duration. We
 * over-estimate on purpose so users aren't surprised at the gantry, per
 * the same philosophy the flat URA fallback was using.
 *
 * Falls back to `estimateCostCents(rows, hours)` when no row matches the
 * given day/hour — better to return something approximate than null.
 */
export function estimateCostCentsAt(
  rows: RateRow[],
  hours: number,
  at: { dayType: DayType; hourOfDay: number },
): number | null {
  if (rows.length === 0) return null;
  const inDay = rows.filter(
    (r) => r.dayType == null || r.dayType === at.dayType,
  );
  if (inDay.length === 0) return estimateCostCents(rows, hours);

  const inBand = inDay.filter((r) => bandCovers(r, at.hourOfDay));
  const pickFrom = inBand.length > 0 ? inBand : inDay;

  // Dominant-band heuristic: highest cost-per-minute wins. URA encodes
  // some night caps as a row like "$5.00 / 510 mins" right next to the
  // "$0.60 / 30 mins" rate row; sorting by perBlockCents alone would pick
  // the cap (which is wrong — it's the daily ceiling, not the per-block
  // rate). Per-minute math correctly puts $0.60/30min above $5/510min
  // (2.0 ¢/min vs ~0.98 ¢/min).
  const dominant = [...pickFrom].sort(
    (a, b) => costPerMinute(b) - costPerMinute(a),
  )[0];

  return estimateCostCents([dominant], hours);
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

/** True when (startTime <= hour < endTime), with wrap-around at midnight.
 * Undefined start/end means "all day". */
function bandCovers(row: RateRow, hour: number): boolean {
  const start = parseHour(row.startTime);
  const end = parseHour(row.endTime);
  if (start == null && end == null) return true;
  if (start == null || end == null) return true;
  if (start <= end) {
    return hour >= start && hour < end;
  }
  // Crosses midnight, e.g. 18:00 → 03:30 → covers 18..23 + 0..3.
  return hour >= start || hour < end;
}

function parseHour(hhmm: string | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h + m / 60;
}
