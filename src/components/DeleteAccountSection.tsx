import { useState } from 'react';
import { deleteAccountUrl } from '../lib/privacy';

/**
 * "Delete account" with a confirm step. `onDelete` re-confirms the account
 * with Google/Apple, so it is called directly from the click (the web popup
 * must open inside the gesture).
 */
export function DeleteAccountSection({
  providerName,
  onDelete,
}: {
  providerName: string;
  onDelete: () => Promise<void>;
}) {
  const [stage, setStage] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    setStage('busy');
    onDelete().catch((err: Error) => {
      setStage('confirm');
      if (err.message !== 'cancelled') setError(err.message);
    });
  };

  if (stage === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStage('confirm')}
        data-track="delete_account_open"
        style={{
          appearance: 'none',
          border: 0,
          background: 'none',
          width: '100%',
          marginTop: 14,
          padding: 8,
          color: 'var(--text-3)',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'underline',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        Delete account
      </button>
    );
  }

  const busy = stage === 'busy';
  return (
    <div
      role="alertdialog"
      aria-labelledby="delete-account-title"
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 14,
        border: '1px solid var(--bad)',
        background: 'var(--bg-1)',
        textAlign: 'left',
      }}
    >
      <div id="delete-account-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
        Delete your account?
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>
        This permanently deletes your profile, cloud saves, check-ins, and the search and activity
        history linked to your account. Carpark corrections you sent stay, without your name. Saves on
        this device stay here until you remove them. You'll confirm with {providerName} first.{' '}
        <a href={deleteAccountUrl()} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
          Details
        </a>
      </p>
      {error && (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bad)' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          onClick={() => {
            setStage('idle');
            setError(null);
          }}
          disabled={busy}
          style={{
            appearance: 'none',
            flex: 1,
            padding: '11px 12px',
            borderRadius: 10,
            border: '0.5px solid var(--line-strong)',
            background: 'var(--bg-1)',
            color: 'var(--text-1)',
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          data-track="delete_account_confirm"
          style={{
            appearance: 'none',
            flex: 1,
            padding: '11px 12px',
            borderRadius: 10,
            border: 0,
            background: 'var(--bad)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          {busy ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </div>
  );
}
