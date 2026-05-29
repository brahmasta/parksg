import { useEffect, useState } from 'react';
import { usePwaInstall } from '../lib/pwa';
import { IconClose, IconShare } from './icons';

/**
 * In-app "Add to home screen" banner. Slides up after a short delay once the
 * app is eligible (installable + not already installed + not recently
 * dismissed). On Chromium it triggers the native install sheet; on iOS Safari
 * it shows the manual Share → Add to Home Screen instructions.
 */
export function InstallPrompt() {
  const { eligible, ios, hasNativePrompt, promptInstall, dismiss } =
    usePwaInstall();
  const [visible, setVisible] = useState(false);

  // Hold off a beat so the banner doesn't fight first paint / the sign-in
  // toast for attention.
  useEffect(() => {
    if (!eligible) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(t);
  }, [eligible]);

  if (!eligible || !visible) return null;

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted' || outcome === 'dismissed') setVisible(false);
  };

  const onDismiss = () => {
    dismiss();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install wheretopark.sg"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 28,
        zIndex: 75,
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line-strong)',
        borderRadius: 16,
        padding: '14px 14px 14px 14px',
        boxShadow:
          '0 14px 36px rgba(14,16,20,0.18), 0 2px 6px rgba(14,16,20,0.08)',
        animation: 'psg-slide-up 240ms cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Brand icon coin */}
        <img
          src="/icon.svg"
          alt=""
          width={44}
          height={44}
          style={{ borderRadius: 11, flexShrink: 0, display: 'block' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.2,
              lineHeight: 1.25,
            }}
          >
            Add wheretopark.sg to your home screen
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--text-2)',
              marginTop: 3,
              lineHeight: 1.45,
            }}
          >
            {ios && !hasNativePrompt
              ? 'Launch it like an app — full screen, one tap away.'
              : 'Open it like an app — full screen and one tap from your home screen.'}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            appearance: 'none',
            border: 0,
            background: 'transparent',
            color: 'var(--text-3)',
            cursor: 'pointer',
            padding: 4,
            margin: '-4px -4px 0 0',
            display: 'inline-flex',
            flexShrink: 0,
          }}
        >
          <IconClose size={16} stroke={2} />
        </button>
      </div>

      {hasNativePrompt ? (
        <button
          type="button"
          onClick={onInstall}
          style={{
            appearance: 'none',
            border: 0,
            width: '100%',
            marginTop: 12,
            padding: '11px 14px',
            background: 'var(--accent)',
            color: 'var(--accent-on)',
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            boxShadow: '0 6px 14px rgba(46,227,194,0.18)',
          }}
        >
          Install
        </button>
      ) : (
        // iOS Safari manual flow.
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            padding: '10px 12px',
            background: 'var(--bg-2)',
            border: '0.5px solid var(--line)',
            borderRadius: 10,
            fontSize: 12.5,
            color: 'var(--text-2)',
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: 'var(--accent)', display: 'inline-flex', flexShrink: 0 }}>
            <IconShare size={16} stroke={2} />
          </span>
          <span>
            Tap <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>Share</strong>, then{' '}
            <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
              Add to Home Screen
            </strong>
            .
          </span>
        </div>
      )}
    </div>
  );
}
