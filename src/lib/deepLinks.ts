import { App as CapApp } from '@capacitor/app';
import { isNative } from './platform';

/**
 * Native only: open wheretopark.sg links in the app. Android App Links (see
 * AndroidManifest.xml and public/.well-known/assetlinks.json) hand matching
 * links to the app. The app routes from the URL it boots on (parseInitialRoute
 * in App.tsx), so a link is opened by loading the same path in the WebView;
 * Capacitor serves index.html for it.
 */

const SITE_HOSTS = new Set(['wheretopark.sg', 'www.wheretopark.sg']);
// The launch URL stays the same across reloads, so remember having followed it.
const HANDLED_KEY = 'psg.launchUrlHandled';

/** The in-app path for a link to the site, or null for any other URL. */
export function inAppPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !SITE_HOSTS.has(u.hostname)) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

function go(path: string): void {
  if (path !== window.location.pathname + window.location.search) window.location.replace(path);
}

/** Awaited before first render. Returns true when it is navigating away, in
 *  which case the caller skips booting this page. */
export async function followLaunchUrl(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const url = (await CapApp.getLaunchUrl())?.url;
    const path = url ? inAppPath(url) : null;
    if (!url || !path || sessionStorage.getItem(HANDLED_KEY) === url) return false;
    sessionStorage.setItem(HANDLED_KEY, url);
    if (path === window.location.pathname + window.location.search) return false;
    go(path);
    return true;
  } catch {
    return false;
  }
}

/** Links tapped while the app is already running. */
export function listenForAppLinks(): void {
  if (!isNative) return;
  void CapApp.addListener('appUrlOpen', ({ url }) => {
    const path = inAppPath(url);
    if (path) go(path);
  });
}
