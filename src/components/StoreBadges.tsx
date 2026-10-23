import { ANDROID_LINK, APP_LINK, offeredStores } from '../lib/appStore';

/**
 * The official store badges, unmodified, in public/: Apple's "Download on
 * the App Store" and Google's "Get it on Google Play". Both are the black
 * artwork in every theme, so they match; Google only makes a black one, and
 * its grey outline (like Apple's) keeps both visible on dark. Each phone sees
 * its own store, desktop sees both, the apps see none (lib/appStore.ts).
 */
export function StoreBadges({ height = 40 }: { height?: number }) {
  const stores = offeredStores();
  if (stores.length === 0) return null;
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      {stores.includes('app_store') && <AppStoreBadge height={height} />}
      {stores.includes('play') && <GooglePlayBadge height={height} />}
    </div>
  );
}

function AppStoreBadge({ height }: { height: number }) {
  const width = Math.round((height * 119.66407) / 40);
  return (
    <a
      href={APP_LINK}
      target="_blank"
      rel="noopener"
      data-track="app_store_badge"
      aria-label="Download wheretopark.sg on the App Store"
      style={{ display: 'inline-block', lineHeight: 0 }}
    >
      <img src="/app-store-badge-black.svg" alt="" width={width} height={height} />
    </a>
  );
}

// Google's PNG is 646x250 with 41px of clear space around a 564x168 badge.
// Scale it so the badge itself matches `height`, and let the link box hide
// the clear space so it lines up with the App Store badge.
const PLAY_PNG = { w: 646, h: 250, pad: 41, badgeW: 564, badgeH: 168 };

function GooglePlayBadge({ height }: { height: number }) {
  const scale = height / PLAY_PNG.badgeH;
  return (
    <a
      href={ANDROID_LINK}
      target="_blank"
      rel="noopener"
      data-track="play_store_badge"
      aria-label="Get wheretopark.sg on Google Play"
      style={{
        display: 'inline-block',
        lineHeight: 0,
        overflow: 'hidden',
        width: Math.round(PLAY_PNG.badgeW * scale),
        height,
      }}
    >
      <img
        src="/google-play-badge.png"
        alt=""
        width={Math.round(PLAY_PNG.w * scale)}
        height={Math.round(PLAY_PNG.h * scale)}
        style={{ margin: -Math.round(PLAY_PNG.pad * scale), maxWidth: 'none' }}
      />
    </a>
  );
}
