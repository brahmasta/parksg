/**
 * Empty state when the "Available only" filter is active and every nearby
 * carpark is full. Distinct from "No carparks nearby" — there ARE carparks
 * here, they're just all full right now — so it offers two ways out: drop the
 * filter (see them anyway) or search a wider radius (a free lot may be just
 * outside 600m). Without this, dense areas like Orchard rendered a silent
 * "0 carparks" that read as a bug (the second half of BUG-1).
 */
export function AvailableEmptyResults({
  destination,
  onClearFilter,
  onExpandRadius,
}: {
  destination: string;
  onClearFilter: () => void;
  onExpandRadius: () => void;
}) {
  return (
    <div
      style={{
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'var(--bad-tint, var(--bg-2))',
          border: '0.5px solid var(--bad, var(--line-strong))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bad, var(--text-2))',
          marginBottom: 16,
          fontFamily: 'var(--font-mono)',
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        0
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: -0.3,
        }}
      >
        Every carpark here is full
      </h2>
      <p
        style={{
          margin: '8px 0 20px',
          fontSize: 13,
          color: 'var(--text-2)',
          lineHeight: 1.5,
          maxWidth: 280,
        }}
      >
        All carparks within 600m of{' '}
        <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
          {destination}
        </strong>{' '}
        report no free lots right now.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onClearFilter}
          style={{
            appearance: 'none',
            border: '0.5px solid var(--line-strong)',
            padding: '11px 16px',
            background: 'var(--bg-1)',
            color: 'var(--text-1)',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Show full carparks
        </button>
        <button
          type="button"
          onClick={onExpandRadius}
          style={{
            appearance: 'none',
            border: '0.5px solid var(--accent)',
            padding: '11px 16px',
            background: 'var(--accent-tint)',
            color: 'var(--accent)',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Search wider
        </button>
      </div>
    </div>
  );
}
