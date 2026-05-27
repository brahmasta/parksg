import type { SavedDestination } from '../lib/types';
import { DestinationIcon } from './DestinationIcon';
import { IconClose } from './icons';

export function DestinationChip({
  d,
  onSearch,
  onRemove,
}: {
  d: SavedDestination;
  onSearch: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSearch}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSearch();
        }
      }}
      style={{
        position: 'relative',
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line)',
        borderRadius: 14,
        padding: '14px 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        minHeight: 92,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'var(--accent-tint)',
            color: 'var(--accent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <DestinationIcon name={d.icon} size={15} />
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${d.name}`}
          style={{
            appearance: 'none',
            border: 0,
            background: 'transparent',
            color: 'var(--text-3)',
            cursor: 'pointer',
            padding: 4,
            marginRight: -6,
            marginTop: -2,
            display: 'inline-flex',
          }}
        >
          <IconClose size={13} stroke={2} />
        </button>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.2,
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {d.name}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-3)',
            marginTop: 2,
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {d.address}
        </div>
      </div>
    </div>
  );
}
