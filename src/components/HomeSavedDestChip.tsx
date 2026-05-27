import type { SavedDestination } from '../lib/types';
import { DestinationIcon } from './DestinationIcon';

export function HomeSavedDestChip({
  d,
  onClick,
}: {
  d: SavedDestination;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px 10px 12px',
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line-strong)',
        borderRadius: 999,
        color: 'var(--text-1)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: 'var(--accent-tint)',
          color: 'var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DestinationIcon name={d.icon} size={12} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: -0.1 }}>
        {d.name}
      </span>
    </button>
  );
}
