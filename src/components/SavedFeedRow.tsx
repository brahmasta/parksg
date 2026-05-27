import type { MergedSaveItem } from '../lib/types';
import { savedAgo } from '../lib/saves';
import { DestinationIcon } from './DestinationIcon';
import { OperatorBadge } from './atoms';
import { IconBookmark, IconClose } from './icons';

/**
 * One row in the unified Saved feed. Card visual is shared; left affordance
 * (icon coin + meta caption) and trailing affordance differ by kind.
 *
 * - Destination row: accent-tinted icon coin, primary tap searches, `×`
 *   trailing removes.
 * - Carpark row: bg-3 icon coin with filled bookmark glyph, primary tap
 *   opens Detail (when we have the live carpark in memory) or no-ops with
 *   a toast (handled in the parent), filled bookmark trailing unsaves.
 */
export function SavedFeedRow({
  item,
  onSearchDestination,
  onOpenCarpark,
  onRemoveDestination,
  onUnsaveCarpark,
}: {
  item: MergedSaveItem;
  onSearchDestination: (d: MergedSaveItem & { kind: 'destination' }) => void;
  onOpenCarpark: (s: MergedSaveItem & { kind: 'carpark' }) => void;
  onRemoveDestination: (id: string) => void;
  onUnsaveCarpark: (id: string) => void;
}) {
  const isDestination = item.kind === 'destination';
  const onPrimary = () =>
    item.kind === 'destination'
      ? onSearchDestination(item)
      : onOpenCarpark(item);
  const onRemove = () =>
    item.kind === 'destination'
      ? onRemoveDestination(item.destination.id)
      : onUnsaveCarpark(item.carpark.id);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onPrimary}
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          textAlign: 'left',
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
          padding: '13px 4px 13px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Type icon coin */}
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: isDestination ? 'var(--accent-tint)' : 'var(--bg-3)',
            color: isDestination ? 'var(--accent)' : 'var(--text-2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.kind === 'destination' ? (
            <DestinationIcon name={item.destination.icon} size={17} />
          ) : (
            <IconBookmark filled size={16} stroke={1.75} />
          )}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Mini meta row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 3,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            <span>{isDestination ? 'Destination' : 'Carpark'}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{savedAgo(item.savedAt)}</span>
          </div>
          {/* Primary name */}
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15.5,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.2,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.kind === 'destination'
              ? item.destination.name
              : item.carpark.name}
          </div>
          {/* Sub */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 3,
              fontSize: 12,
              color: 'var(--text-3)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {item.kind === 'destination' ? (
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {item.destination.address}
              </span>
            ) : (
              <>
                <OperatorBadge operator={item.carpark.operator} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  {item.carpark.area}
                </span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                    letterSpacing: -0.1,
                  }}
                >
                  ${item.carpark.lastCost.toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* Trailing affordance — × vs filled bookmark */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={
          item.kind === 'destination'
            ? `Remove ${item.destination.name}`
            : `Remove from saved · ${item.carpark.name}`
        }
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          width: 44,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isDestination ? 'var(--text-3)' : 'var(--accent)',
          borderLeft: '0.5px solid var(--line)',
        }}
      >
        {isDestination ? (
          <IconClose size={14} stroke={2} />
        ) : (
          <IconBookmark filled size={16} stroke={1.75} />
        )}
      </button>
    </div>
  );
}
