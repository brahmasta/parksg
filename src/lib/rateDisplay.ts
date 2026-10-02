import type { RateRow } from './types';

/**
 * Cosmetic-string synthesizers for RateRow.
 *
 * RateRow's `window` / `rate` / `cap` are optional. RateTable calls these
 * helpers when a row doesn't pre-carry strings — handy for sources like
 * URA that emit pure structured rows and let the UI render them. Existing
 * hand-written rows (HDB / mock) that already set `window` / `rate`
 * continue to win.
 */

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function humanTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const meridiem = h < 12 || h === 24 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${h12}${meridiem}`
    : `${h12}:${String(m).padStart(2, '0')}${meridiem}`;
}

export function synthesizeWindow(row: RateRow): string {
  if (row.window) return row.window;
  if (row.startTime && row.endTime) {
    return `${humanTime(row.startTime)} – ${humanTime(row.endTime)}`;
  }
  return 'All day';
}

export function synthesizeRate(row: RateRow): string {
  if (row.rate) return row.rate;
  const parts: string[] = [];
  if (row.firstHourCents != null) {
    const firstMin = row.firstBlockMinutes ?? 60;
    const tierLabel =
      firstMin === 60 ? '1st hr' : `1st ${firstMin} min`;
    parts.push(`${fmtCents(row.firstHourCents)} / ${tierLabel}`);
  }
  // Per-entry rows are stored with per_block_cents = block_minutes = 0 (both
  // NOT NULL in rate_rows), so a 0/0 pair means "no per-block charge" — not
  // "$0.00 / 0 min", which hid every per-entry price behind it.
  const hasBlock =
    row.perBlockCents != null &&
    row.blockMinutes != null &&
    !(row.perBlockCents === 0 && row.blockMinutes === 0);
  if (hasBlock) {
    parts.push(`${fmtCents(row.perBlockCents!)} / ${row.blockMinutes} min`);
  }
  if (row.perEntryCents != null && !hasBlock && row.firstHourCents == null) {
    parts.push(row.perEntryCents === 0 ? 'Free' : `${fmtCents(row.perEntryCents)} / entry`);
  }
  if (parts.length === 0) {
    // Truly nothing structured — caller is showing a free / placeholder row.
    return 'See operator';
  }
  return parts.join(' · ');
}

export function synthesizeCap(row: RateRow): string | undefined {
  if (row.cap) return row.cap;
  if (row.capCents != null) return `${fmtCents(row.capCents)} cap`;
  return undefined;
}
