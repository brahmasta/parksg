/**
 * Shared presentational components for the /admin dashboard.
 *
 * Style tokens live in ./uiTokens so this file exports components only —
 * react-refresh requires that split to keep fast refresh working.
 */
import { TYPE, card, cardSoft, statLabel } from './uiTokens';

/** Section divider: a small mono label with a hairline rule running off to the right. */
export function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
      <span style={{ flex: 1, height: 0, borderTop: '0.5px solid var(--line)' }} />
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        ...card,
        background: accent ? 'var(--accent)' : 'var(--bg-1)',
        border: accent ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
      }}
    >
      <div
        style={{
          ...statLabel,
          color: accent ? 'color-mix(in srgb, var(--accent-on) 80%, transparent)' : 'var(--text-3)',
        }}
      >
        {label}
      </div>
      <div style={{ ...TYPE.hero, marginTop: 10, color: accent ? 'var(--accent-on)' : 'var(--text-1)' }}>
        {value.toLocaleString()}
      </div>
      {sub && (
        <div
          style={{
            ...TYPE.caption,
            marginTop: 7,
            color: accent ? 'color-mix(in srgb, var(--accent-on) 70%, transparent)' : 'var(--text-2)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/** Tier-2 stat: smaller number, lighter card; optionally actionable (warn tone). */
export function MiniStat({
  label,
  value,
  sub,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: 'default' | 'warn';
  onClick?: () => void;
}) {
  const warn = tone === 'warn';
  const inner = (
    <>
      <div style={{ ...statLabel, color: warn ? 'var(--warn)' : 'var(--text-3)' }}>{label}</div>
      <div style={{ ...TYPE.metric, marginTop: 8, color: warn ? 'var(--warn)' : 'var(--text-1)' }}>
        {value.toLocaleString()}
      </div>
      {sub && (
        <div style={{ ...TYPE.caption, marginTop: 6, color: warn ? 'var(--warn)' : 'var(--text-3)' }}>{sub}</div>
      )}
    </>
  );
  const style: React.CSSProperties = {
    ...cardSoft,
    textAlign: 'left',
    width: '100%',
    background: warn ? 'var(--warn-bg)' : 'var(--bg-1)',
    border: warn
      ? '0.5px solid color-mix(in srgb, var(--warn) 35%, transparent)'
      : '0.5px solid var(--line-strong)',
    cursor: onClick ? 'pointer' : 'default',
  };
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...style, appearance: 'none', font: 'inherit' }}>
      {inner}
    </button>
  ) : (
    <div style={style}>{inner}</div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '8px 0' }}>{children}</div>;
}

/** Horizontal labelled bars (top-N lists). */
export function Bars({
  rows,
  color = 'var(--accent)',
  suffix,
}: {
  rows: { label: string; value: number }[];
  color?: string;
  /** Appended to each value, e.g. '%' for a rate rather than a count. */
  suffix?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 110,
              flexShrink: 0,
              fontSize: 12.5,
              color: 'var(--text-1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={r.label}
          >
            {r.label}
          </div>
          <div style={{ flex: 1, height: 14, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: color, borderRadius: 999 }}
            />
          </div>
          <div
            style={{
              width: 42,
              flexShrink: 0,
              textAlign: 'right',
              fontSize: 12.5,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-2)',
            }}
          >
            {r.value.toLocaleString()}
            {suffix ?? ''}
          </div>
        </div>
      ))}
    </div>
  );
}
