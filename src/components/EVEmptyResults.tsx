import { IconBolt } from './icons';

/**
 * Empty state when the EV filter is active and no nearby carparks have
 * chargers. Distinct from "No carparks nearby" — there ARE carparks here,
 * just none with chargers — so the CTA nudges the user to drop the filter
 * rather than expand the radius (going wider rarely helps).
 */
export function EVEmptyResults({
  destination,
  onClearFilter,
}: {
  destination: string;
  onClearFilter: () => void;
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
          background: 'var(--accent-tint)',
          border: '0.5px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          marginBottom: 16,
        }}
      >
        <IconBolt size={28} stroke={2} />
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
        No EV-equipped carparks here
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
        We didn't find public EV chargers within 600m of{' '}
        <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
          {destination}
        </strong>
        .
      </p>
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
        Show all carparks
      </button>
    </div>
  );
}
