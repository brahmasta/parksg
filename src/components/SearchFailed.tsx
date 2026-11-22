import { failureCopy, type SearchFailure } from '../lib/searchFailure';
import { IconRefresh, IconWarning } from './icons';

/**
 * Shown instead of the carpark list when a search could not be completed:
 * the place lookup or the carpark load failed. Distinct from the "No carparks
 * nearby" empty state, which means the search worked and found nothing.
 */
export function SearchFailed({
  failure,
  query,
  onRetry,
  onBack,
  compact = false,
}: {
  failure: SearchFailure;
  query: string;
  onRetry: () => void;
  /** Omitted on desktop, where the search box stays on screen above. */
  onBack?: () => void;
  /** Desktop rail: a card rather than a full-height centred block. */
  compact?: boolean;
}) {
  const copy = failureCopy(failure, query);
  return (
    <div
      role="alert"
      style={{
        padding: compact ? '28px 20px' : '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        ...(compact
          ? { marginTop: 8, background: 'var(--bg-1)', border: '0.5px solid var(--line)', borderRadius: 14 }
          : {}),
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--warn-bg)',
          color: 'var(--warn)',
        }}
      >
        <IconWarning size={26} stroke={2} />
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: compact ? 17 : 22,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: -0.3,
        }}
      >
        {copy.title}
      </h2>
      <p
        style={{
          margin: '8px 0 22px',
          fontSize: 13.5,
          color: 'var(--text-2)',
          lineHeight: 1.5,
          maxWidth: 300,
        }}
      >
        {copy.body}
      </p>
      {copy.canRetry && (
        <button
          onClick={onRetry}
          data-track="search_retry"
          style={{
            appearance: 'none',
            border: 0,
            padding: '12px 18px',
            background: 'var(--accent)',
            color: 'var(--accent-on)',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
          }}
        >
          <IconRefresh size={14} stroke={2.5} />
          Try again
        </button>
      )}
      {onBack && (
      <button
        onClick={onBack}
        data-track="nav_back"
        style={{
          appearance: 'none',
          border: 0,
          marginTop: copy.canRetry ? 12 : 0,
          padding: '10px 14px',
          minHeight: 44,
          background: 'transparent',
          color: copy.canRetry ? 'var(--text-2)' : 'var(--accent)',
          fontSize: copy.canRetry ? 13 : 14,
          fontWeight: copy.canRetry ? 500 : 600,
          cursor: 'pointer',
        }}
      >
        Change destination
      </button>
      )}
    </div>
  );
}
