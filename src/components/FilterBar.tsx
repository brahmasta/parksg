import type { SortBy } from '../lib/resultsView';

/**
 * Results filter + sort bar — a Cheapest/Nearest segmented control plus an
 * "Available only" toggle. Shared by the mobile results header and (later) the
 * desktop left rail. The EV filter stays a separate pill alongside this bar.
 */
export function FilterBar({
  sortBy,
  onSortBy,
  availableOnly,
  onAvailableOnly,
}: {
  sortBy: SortBy;
  onSortBy: (v: SortBy) => void;
  availableOnly: boolean;
  onAvailableOnly: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {/* Sort segmented control */}
      <div
        role="radiogroup"
        aria-label="Sort carparks"
        style={{
          display: 'inline-flex',
          padding: 3,
          gap: 3,
          background: 'var(--bg-2)',
          border: '0.5px solid var(--line)',
          borderRadius: 10,
        }}
      >
        {([['cost', 'Cheapest'], ['distance', 'Nearest']] as [SortBy, string][]).map(
          ([key, label]) => {
            const active = sortBy === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSortBy(key)}
                style={{
                  appearance: 'none',
                  border: 0,
                  borderRadius: 7,
                  padding: '6px 13px',
                  background: active ? 'var(--bg-1)' : 'transparent',
                  color: active ? 'var(--text-1)' : 'var(--text-2)',
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 120ms ease',
                  minHeight: 32,
                }}
              >
                {label}
              </button>
            );
          },
        )}
      </div>

      {/* Available-only toggle */}
      <button
        type="button"
        onClick={() => onAvailableOnly(!availableOnly)}
        aria-pressed={availableOnly}
        style={{
          appearance: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 13px 7px 11px',
          borderRadius: 999,
          cursor: 'pointer',
          fontSize: 12.5,
          fontWeight: 600,
          transition: 'all 120ms ease',
          minHeight: 32,
          background: availableOnly ? 'var(--accent-tint-strong)' : 'var(--bg-1)',
          border: availableOnly ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
          color: availableOnly ? 'var(--accent)' : 'var(--text-2)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: 'var(--ok)',
            boxShadow: availableOnly ? '0 0 0 3px var(--ok-bg)' : 'none',
          }}
        />
        Available only
      </button>
    </div>
  );
}
