import type { CarparkEV } from '../lib/types';
import { evSummary, isEvStale } from '../lib/ev';
import { IconBolt } from './icons';

/**
 * Compact identity-row chip: lightning + available-connector count.
 * Three states:
 *   ≥1 available  → teal-bordered, accent-tinted bg, accent text
 *   0 available   → muted (chargers exist but all busy / not available)
 *   stale feed    → muted regardless of count, number replaced by "—"
 * Renders nothing when the carpark has no chargers (cp.ev?.hasCharging falsy).
 * The chip is non-tappable — the whole card is the tap target.
 */
export function EVChip({ ev }: { ev: CarparkEV | undefined | null }) {
  if (!ev || !ev.hasCharging) return null;
  const summary = evSummary(ev);
  if (!summary) return null;

  const stale = isEvStale(ev);
  const hasAvail = !stale && summary.available > 0;
  const label = stale ? '—' : String(summary.available);
  const aria = stale
    ? `EV charging available (live status unavailable)`
    : `${summary.available} of ${summary.total} EV ports available`;

  return (
    <span
      title={aria}
      aria-label={aria}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.4,
        lineHeight: 1,
        padding: '2px 6px 2px 4px',
        borderRadius: 4,
        background: hasAvail ? 'var(--accent-tint)' : 'var(--bg-3)',
        color: hasAvail ? 'var(--accent)' : 'var(--text-3)',
        border: '0.5px solid ' + (hasAvail ? 'var(--accent)' : 'var(--line-strong)'),
      }}
    >
      <IconBolt size={11} stroke={2.25} />
      {label}
    </span>
  );
}
