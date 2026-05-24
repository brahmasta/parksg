import type { CSSProperties } from 'react';
import type {
  AvailabilityStatus,
  DurationHours,
  LotType,
  Operator,
} from '../lib/types';
import { availabilityBgVar, availabilityColorVar } from '../lib/availability';
import { DURATIONS } from '../lib/mockData';
import { IconChevronRight, IconClose, IconSearch } from './icons';

/* ── Availability dot ────────────────────────────────────────────────────── */
export function AvailabilityDot({
  status,
  size = 8,
}: {
  status: AvailabilityStatus;
  size?: number;
}) {
  const color = availabilityColorVar(status);
  return (
    <span
      className={status === 'limited' ? 'psg-pulse' : ''}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        boxShadow:
          status === 'limited' ? `0 0 0 4px ${availabilityBgVar(status)}` : 'none',
        flexShrink: 0,
      }}
    />
  );
}

/* ── Operator badge ──────────────────────────────────────────────────────── */
export function OperatorBadge({
  operator,
  size = 'sm',
}: {
  operator: Operator;
  size?: 'sm' | 'lg';
}) {
  const styles: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: size === 'lg' ? 11 : 10,
    fontWeight: 500,
    letterSpacing: 0.6,
    padding: size === 'lg' ? '3px 7px' : '2px 6px',
    borderRadius: 4,
    background: 'var(--bg-3)',
    color: 'var(--text-2)',
    border: '0.5px solid var(--line-strong)',
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 1,
  };
  return <span style={styles}>{operator}</span>;
}

/* ── Lot-type chips ──────────────────────────────────────────────────────── */
const LOT_LABELS: Record<LotType, [string, string]> = {
  C: ['C', 'Car'],
  M: ['M', 'Motorcycle'],
  H: ['H', 'Heavy'],
};

export function LotTypeChips({ types }: { types: LotType[] }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {types.map((t) => (
        <span
          key={t}
          title={LOT_LABELS[t][1]}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--text-2)',
            background: 'var(--bg-3)',
            border: '0.5px solid var(--line-strong)',
          }}
        >
          {LOT_LABELS[t][0]}
        </span>
      ))}
    </div>
  );
}

/* ── Duration chip strip ─────────────────────────────────────────────────── */
export function DurationStrip({
  value,
  onChange,
  compact = false,
}: {
  value: DurationHours;
  onChange: (v: DurationHours) => void;
  compact?: boolean;
}) {
  return (
    <div
      className="psg-no-scrollbar"
      role="radiogroup"
      aria-label="Planned stay"
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: 0,
        scrollSnapType: 'x mandatory',
      }}
    >
      {DURATIONS.map((d) => {
        const active = d.value === value;
        return (
          <button
            key={d.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(d.value)}
            style={{
              appearance: 'none',
              flexShrink: 0,
              padding: compact ? '6px 12px' : '9px 14px',
              borderRadius: 999,
              border: active
                ? '1px solid var(--accent)'
                : '0.5px solid var(--line-strong)',
              background: active ? 'var(--accent-tint-strong)' : 'var(--bg-1)',
              color: active ? 'var(--accent-on)' : 'var(--text-2)',
              fontSize: compact ? 12.5 : 13.5,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              scrollSnapAlign: 'start',
              letterSpacing: 0.1,
              transition: 'all 120ms ease',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              minHeight: 32,
            }}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Search field ────────────────────────────────────────────────────────── */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = 'Where to?',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px',
        background: 'var(--bg-2)',
        border: '0.5px solid var(--line-strong)',
        borderRadius: 14,
      }}
    >
      <IconSearch
        size={18}
        stroke={2}
        style={{ color: 'var(--text-2)', flexShrink: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search destination"
        style={{
          flex: 1,
          minWidth: 0,
          border: 0,
          outline: 'none',
          background: 'transparent',
          color: 'var(--text-1)',
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          letterSpacing: -0.1,
          padding: 0,
        }}
      />
      {value && (
        <>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{
              appearance: 'none',
              border: 0,
              padding: 0,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: 'var(--bg-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-2)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <IconClose size={12} stroke={2.5} />
          </button>
          <button
            type="submit"
            aria-label="Search"
            style={{
              appearance: 'none',
              border: 0,
              padding: 0,
              width: 30,
              height: 30,
              borderRadius: 999,
              background: 'var(--accent)',
              color: 'var(--accent-on)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(46,227,194,0.35)',
            }}
          >
            <IconChevronRight size={16} stroke={2.5} />
          </button>
        </>
      )}
    </form>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="psg-spin"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '1.5px solid var(--line-strong)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
      }}
    />
  );
}
