import { useState, type CSSProperties } from 'react';
import { APP_STORE_URL, dismissAppStoreBanner, showAppStoreBanner } from '../lib/appStore';
import { IconClose } from './icons';

/**
 * "Now on the App Store" announcement at the top of the home screen, phone
 * and desktop. Dismissing it hides it on this browser for good. Not shown in
 * the apps, on Android, or in iOS Safari (Apple's Smart App Banner covers
 * that; see lib/appStore.ts).
 */
export function AppStoreBanner({ style }: { style?: CSSProperties }) {
  const [visible, setVisible] = useState(showAppStoreBanner);
  if (!visible) return null;

  const onDismiss = () => {
    dismissAppStoreBanner();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="wheretopark.sg is on the App Store"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 10px 10px 12px',
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line-strong)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      <img src="/icon.svg" alt="" width={36} height={36} style={{ borderRadius: 9, flexShrink: 0, display: 'block' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.2,
            lineHeight: 1.25,
          }}
        >
          Now on the App Store
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.35 }}>
          Free for iPhone.
        </div>
      </div>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener"
        aria-label="Get wheretopark.sg on the App Store"
        data-track="app_store_banner"
        style={{
          flexShrink: 0,
          padding: '7px 16px',
          background: 'var(--accent)',
          color: 'var(--accent-on)',
          borderRadius: 999,
          fontSize: 13.5,
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Get
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        data-track="app_store_banner_dismiss"
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          color: 'var(--text-3)',
          cursor: 'pointer',
          padding: 4,
          display: 'inline-flex',
          flexShrink: 0,
        }}
      >
        <IconClose size={16} stroke={2} />
      </button>
    </div>
  );
}
