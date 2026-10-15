import { isNative } from './platform';

/** The iPhone app's App Store listing (Singapore storefront). */
export const APP_STORE_ID = '6818932533';
export const APP_STORE_URL = 'https://apps.apple.com/sg/app/wheretopark-sg-sg-parking/id6818932533';

/** The short link we share and link to. vercel.json redirects /app (and
 *  /ios) to APP_STORE_URL; Android phones go to the website until the Play
 *  listing is public, then that redirect points at Google Play. */
export const APP_LINK = 'https://wheretopark.sg/app';

const BANNER_DISMISS_KEY = 'psg.appStoreBannerDismissed';

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function isAndroid(): boolean {
  return /android/i.test(ua());
}

/** Safari on iPhone / iPad, which shows Apple's Smart App Banner from the
 *  `apple-itunes-app` meta tag in index.html. Other iOS browsers don't. */
function isIosSafari(): boolean {
  const s = ua();
  const iDevice =
    /iphone|ipad|ipod/i.test(s) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  return iDevice && /safari/i.test(s) && !/crios|fxios|edgios|opios/i.test(s);
}

/** Offer the iPhone app on the website. Not inside the apps, and not on
 *  Android phones, which can't install it. */
export function offerAppStore(): boolean {
  return !isNative && !isAndroid();
}

/** Our own "Now on the App Store" banner. Off in iOS Safari, where Apple's
 *  Smart App Banner already offers Get / Open. */
export function showAppStoreBanner(): boolean {
  if (!offerAppStore() || isIosSafari()) return false;
  try {
    return localStorage.getItem(BANNER_DISMISS_KEY) == null;
  } catch {
    return true;
  }
}

export function dismissAppStoreBanner(): void {
  try {
    localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode: it just shows again next visit */
  }
}
