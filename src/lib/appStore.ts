import { isNative } from './platform';

/** The iPhone app's App Store listing (Singapore storefront). */
export const APP_STORE_ID = '6818932533';
export const APP_STORE_URL = 'https://apps.apple.com/sg/app/wheretopark-sg-sg-parking/id6818932533';

/** The Android app's Google Play listing. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=sg.wheretopark.app';

/** The short links we share and link to. vercel.json redirects /app to the
 *  App Store, or to Google Play on Android phones; /ios and /android always
 *  go to their own store, so desktop visitors can pick. */
export const APP_LINK = 'https://wheretopark.sg/app';
export const IOS_LINK = 'https://wheretopark.sg/ios';
export const ANDROID_LINK = 'https://wheretopark.sg/android';

export type Store = 'app_store' | 'play';

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

export function isAndroid(): boolean {
  return /android/i.test(ua());
}

function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(ua()) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

/** The stores to offer on the website: the phone's own store, or both on
 *  desktop. None inside the apps. (Safari on iPhone also shows Apple's Smart
 *  App Banner, from the `apple-itunes-app` meta tag in index.html.) */
export function offeredStores(): Store[] {
  if (isNative) return [];
  if (isAndroid()) return ['play'];
  if (isIos()) return ['app_store'];
  return ['app_store', 'play'];
}
