import { useState, type CSSProperties } from 'react';
import { ANDROID_LINK, APP_LINK, IOS_LINK, bannerStores, dismissAppBanner, type Store } from '../lib/appStore';
import { IconClose } from './icons';

const COPY: Record<'app_store' | 'play' | 'both', { title: string; sub: string; label: string }> = {
  app_store: { title: 'Now on the App Store', sub: 'Free for iPhone.', label: 'wheretopark.sg is on the App Store' },
  play: { title: 'Now on Google Play', sub: 'Free for Android.', label: 'wheretopark.sg is on Google Play' },
  both: {
    title: 'Now on iPhone and Android',
    sub: 'Free on both app stores.',
    label: 'wheretopark.sg is on the App Store and Google Play',
  },
};

/**
 * "Now on the App Store / Google Play" announcement at the top of the home
 * screen, phone and desktop. Phones see their own store; desktop sees both,
 * with a button for each. Dismissing it hides it on this browser for good.
 * Not shown in the apps, or in iOS Safari (Apple's Smart App Banner covers
 * that; see lib/appStore.ts).
 */
export function AppStoreBanner({ style }: { style?: CSSProperties }) {
  const [stores, setStores] = useState<Store[]>(bannerStores);
  if (stores.length === 0) return null;

  const copy = COPY[stores.length > 1 ? 'both' : stores[0]];
  const onDismiss = () => {
    dismissAppBanner(stores);
    setStores([]);
  };

  return (
    <div
      role="region"
      aria-label={copy.label}
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
          {copy.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.35 }}>{copy.sub}</div>
      </div>
      {stores.length > 1 ? (
        <>
          <GetButton href={IOS_LINK} track="app_store_banner" label="Get wheretopark.sg on the App Store">
            iPhone
          </GetButton>
          <GetButton href={ANDROID_LINK} track="play_store_banner" label="Get wheretopark.sg on Google Play">
            Android
          </GetButton>
        </>
      ) : stores[0] === 'play' ? (
        <GetButton href={ANDROID_LINK} track="play_store_banner" label="Get wheretopark.sg on Google Play">
          Get
        </GetButton>
      ) : (
        <GetButton href={APP_LINK} track="app_store_banner" label="Get wheretopark.sg on the App Store">
          Get
        </GetButton>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        data-track={stores.includes('play') ? 'play_store_banner_dismiss' : 'app_store_banner_dismiss'}
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

function GetButton({
  href,
  track,
  label,
  children,
}: {
  href: string;
  track: string;
  label: string;
  children: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      data-track={track}
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
      {children}
    </a>
  );
}
