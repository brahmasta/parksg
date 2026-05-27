import { BottomSheet } from './BottomSheet';
import { IconSignOut } from './icons';

export function SignOutSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '8px 20px 4px', textAlign: 'center' }}>
        <div
          style={{
            margin: '6px auto 14px',
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--bad-bg)',
            color: 'var(--bad)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconSignOut size={22} stroke={2} />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 19,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.3,
            lineHeight: 1.2,
          }}
        >
          Sign out of wheretopark.sg?
        </div>
        <p
          style={{
            margin: '8px auto 18px',
            fontSize: 13,
            color: 'var(--text-2)',
            lineHeight: 1.5,
            maxWidth: 280,
          }}
        >
          Your saved carparks and destinations stay in your account. You can
          sign back in any time to bring them back.
        </p>
      </div>
      <div
        style={{
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onConfirm}
          style={{
            appearance: 'none',
            border: 0,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--bad)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: -0.1,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            appearance: 'none',
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--bg-1)',
            color: 'var(--text-1)',
            border: '0.5px solid var(--line-strong)',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
