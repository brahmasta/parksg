import type { SavedCarparkSnapshot } from '../lib/types';
import { IconBookmark } from './icons';

export function HomeSavedCarparkChip({
  cp,
  onClick,
}: {
  cp: SavedCarparkSnapshot;
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
        padding: '10px 12px 10px 10px',
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
          background: 'var(--bg-3)',
          color: 'var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconBookmark filled size={12} stroke={1.75} />
      </span>
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          letterSpacing: -0.1,
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {cp.name}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-3)',
          letterSpacing: 0.2,
          paddingLeft: 6,
          borderLeft: '0.5px solid var(--line)',
          marginLeft: 2,
        }}
      >
        ${cp.lastCost.toFixed(2)}
      </span>
    </button>
  );
}
