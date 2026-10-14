import { APP_STORE_URL, offerAppStore } from '../lib/appStore';

/**
 * Apple's official "Download on the App Store" badge (artwork from Apple's
 * marketing tools, unmodified, in public/). Black on the light themes, white
 * on dark; index.css swaps them on `data-theme`. Hidden where the iPhone app
 * can't be installed or already is (lib/appStore.ts).
 */
export function AppStoreBadge({ height = 40 }: { height?: number }) {
  if (!offerAppStore()) return null;
  const width = Math.round((height * 119.66407) / 40);
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener"
      data-track="app_store_badge"
      aria-label="Download wheretopark.sg on the App Store"
      style={{ display: 'inline-block', lineHeight: 0 }}
    >
      <img className="psg-badge-light" src="/app-store-badge-black.svg" alt="" width={width} height={height} />
      <img className="psg-badge-dark" src="/app-store-badge-white.svg" alt="" width={width} height={height} />
    </a>
  );
}
