import type { MouseEvent } from 'react';
import { IconBookmark } from './icons';

export function BookmarkToggle({
  saved,
  onToggle,
  size = 22,
}: {
  saved: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={saved ? 'Remove from saved' : 'Save carpark'}
      aria-pressed={saved}
      style={{
        appearance: 'none',
        border: 0,
        padding: 0,
        width: 38,
        height: 38,
        borderRadius: 999,
        background: 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        color: saved ? 'var(--accent)' : 'var(--text-3)',
        transition: 'color 140ms ease',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          transform: saved ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <IconBookmark filled={saved} size={size} stroke={1.75} />
      </span>
    </button>
  );
}
