import { AppLauncher } from '@capacitor/app-launcher';
import { isNative } from './platform';

/** Open a URL outside the app. Native hands https links to the OS, which opens
 *  Google Maps / Waze / Apple Maps when installed and the browser otherwise.
 *  The web keeps the anchor-click approach (never treated as a blocked popup). */
export function openExternal(url: string): void {
  if (isNative) {
    AppLauncher.openUrl({ url }).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Native only: route every `<a target="_blank">` (footer, About, sources,
 *  "Open in Google Maps") through openExternal so links leave the WebView. */
export function installExternalLinkHandler(): void {
  if (!isNative) return;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
    if (!a || !/^https?:/i.test(a.href)) return;
    e.preventDefault();
    openExternal(a.href);
  });
}
