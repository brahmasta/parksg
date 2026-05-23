import { IconRefresh, IconWarning } from './icons';

export function DegradedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="status"
      style={{
        margin: '0 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: 'var(--warn-bg)',
        border: '0.5px solid var(--warn)',
        borderRadius: 10,
        color: 'var(--text-1)',
      }}
    >
      <span style={{ color: 'var(--warn)', display: 'inline-flex' }}>
        <IconWarning size={16} stroke={2} />
      </span>
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.35 }}>
        Live availability unavailable — showing rates only.
      </div>
      <button
        onClick={onRetry}
        style={{
          appearance: 'none',
          border: 0,
          padding: '5px 10px',
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--warn)',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
        }}
      >
        <IconRefresh size={12} stroke={2.5} />
        Retry
      </button>
    </div>
  );
}
