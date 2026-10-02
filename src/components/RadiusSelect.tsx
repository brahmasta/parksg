import { IconChevronDown } from './icons';
import { RADIUS_OPTIONS, fmtRadius } from '../lib/radius';

/**
 * "within 600m ▾" — the search radius as an inline native select, so it reads
 * as part of the results summary line but opens the platform picker on tap.
 */
export function RadiusSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (m: number) => void;
}) {
  // A radius from elsewhere (e.g. "search wider" = 1km) that isn't an option
  // still shows correctly.
  const options = RADIUS_OPTIONS.includes(value as (typeof RADIUS_OPTIONS)[number])
    ? RADIUS_OPTIONS
    : [...RADIUS_OPTIONS, value].sort((a, b) => a - b);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        aria-label="Search radius"
        data-track="search_radius"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          border: 0,
          background: 'transparent',
          padding: '0 15px 0 0',
          margin: 0,
          font: 'inherit',
          fontWeight: 600,
          color: 'var(--accent)',
          cursor: 'pointer',
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textUnderlineOffset: 3,
        }}
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {fmtRadius(m)}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        style={{ position: 'absolute', right: 0, pointerEvents: 'none', color: 'var(--accent)', display: 'inline-flex' }}
      >
        <IconChevronDown size={12} stroke={2.25} />
      </span>
    </span>
  );
}
