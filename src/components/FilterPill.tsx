import type { ReactNode } from 'react';

/**
 * Filter pill used in the Results header — shared by the EV and
 * Available-only filters so they stay visually consistent.
 *
 * Inactive: hairline border, secondary text, transparent bg.
 * Active:   1px accent border, accent-tinted bg, accent-on text.
 *
 * Pass `dot` for the existing "● Available" status-dot style, or `icon`
 * (e.g. <IconBolt/>) for the lightning glyph used by EV.
 */
export function FilterPill({
  active,
  onClick,
  label,
  icon,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        border: active
          ? '1px solid var(--accent)'
          : '0.5px solid var(--line-strong)',
        background: active ? 'var(--accent-tint-strong)' : 'transparent',
        color: active ? 'var(--accent-on)' : 'var(--text-2)',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        lineHeight: 1,
        minHeight: 26,
      }}
    >
      {dot && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: active ? 'var(--accent)' : 'var(--ok)',
            display: 'inline-block',
          }}
        />
      )}
      {icon && (
        <span style={{ display: 'inline-flex', color: active ? 'var(--accent)' : 'currentColor' }}>
          {icon}
        </span>
      )}
      {label}
    </button>
  );
}
