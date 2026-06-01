import type { Carpark, DurationHours } from '../lib/types';
import {
  availabilityStatus,
  durationLabel,
  formatCost,
  formatDistance,
} from '../lib/availability';
import { isStaleRates } from '../lib/rateSource';
import { AvailabilityDot, OperatorBadge, StaleRatesBadge } from './atoms';
import { EVChip } from './EVChip';
import { BookmarkToggle } from './BookmarkToggle';
import { IconWalk } from './icons';

export function CarparkCard({
  cp,
  duration,
  rank,
  isCheapest,
  degraded,
  onClick,
  saved,
  onToggleSave,
}: {
  cp: Carpark;
  duration: DurationHours;
  rank: number;
  isCheapest: boolean;
  degraded: boolean;
  onClick: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const lots = degraded ? null : cp.lotsAvailable;
  const status = availabilityStatus(lots);
  const lotsLabel = lots == null ? '—' : lots === 0 ? 'Full' : `${lots} lots`;
  const cost = cp.estByHours[duration];
  const stale = isStaleRates(cp);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        textAlign: 'left',
        display: 'block',
        width: '100%',
        padding: '14px 14px 13px 16px',
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line)',
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      {/* Top row: rank + name + cost */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
              flexWrap: 'wrap',
              rowGap: 4,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: isCheapest ? 'var(--accent-on)' : 'var(--text-3)',
                fontWeight: 500,
                letterSpacing: 0.4,
              }}
            >
              #{rank}
            </span>
            <OperatorBadge operator={cp.operator} />
            <EVChip ev={cp.ev} />
            {stale && <StaleRatesBadge />}
            {isCheapest && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  color: 'var(--accent-on)',
                  background: 'var(--accent)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                Cheapest
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 600,
              lineHeight: 1.15,
              color: 'var(--text-1)',
              letterSpacing: -0.1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cp.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-3)',
              marginTop: 2,
            }}
          >
            {cp.block}
          </div>
        </div>

        {/* Cost — hero number */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 600,
              lineHeight: 1,
              color: 'var(--text-1)',
              letterSpacing: -0.6,
            }}
          >
            {formatCost(cost)}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: stale ? 'var(--warn)' : 'var(--text-3)',
              marginTop: 4,
              fontFamily: 'var(--font-mono)',
              letterSpacing: 0.2,
              textTransform: 'uppercase',
            }}
          >
            Est · {stale ? '2018' : durationLabel(duration)}
          </div>
        </div>

        {onToggleSave && (
          <div style={{ marginTop: -4, marginRight: -8 }}>
            <BookmarkToggle saved={!!saved} onToggle={onToggleSave} />
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          height: 0.5,
          background: 'var(--line)',
          margin: '12px -16px 10px',
        }}
      />

      {/* Bottom row: walk + availability */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-2)',
            fontSize: 12.5,
          }}
        >
          <IconWalk size={14} stroke={2} />
          <span>{cp.walkMin} min</span>
          <span style={{ color: 'var(--text-3)' }}>·</span>
          <span style={{ color: 'var(--text-3)' }}>
            {formatDistance(cp.walkMeters)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AvailabilityDot status={status} />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: degraded
                ? 'var(--text-3)'
                : status === 'full'
                ? 'var(--bad)'
                : status === 'limited'
                ? 'var(--warn)'
                : 'var(--text-1)',
            }}
          >
            {lotsLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
