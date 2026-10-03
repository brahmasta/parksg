import { Share } from '@capacitor/share';
import { siteOrigin } from './apiBase';
import { isNative } from './platform';

/**
 * Share a "Carparks near X" results page.
 *
 * On a `/parking-near/:slug` page the clean path is already the canonical,
 * SEO-rendered link, so it's shared as is. Any other destination is shared as
 * `/?to=lat,lng&dest=label`, which App parses as a shared link with no
 * carpark and lands the recipient on that destination's live results.
 */
export function resultsShareUrl(
  dest: { label: string; lat: number; lng: number },
  loc: Pick<Location, 'origin' | 'pathname'> = { origin: siteOrigin(), pathname: window.location.pathname },
): string {
  if (/^\/parking-near\/[^/]+\/?$/.test(loc.pathname)) {
    return `${loc.origin}${loc.pathname.replace(/\/$/, '')}`;
  }
  const params = new URLSearchParams({
    to: `${dest.lat.toFixed(6)},${dest.lng.toFixed(6)}`,
    dest: dest.label,
  });
  return `${loc.origin}/?${params}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Share a link through the OS share sheet, else copy it. The native apps use
 *  the Capacitor plugin: Android's WebView has no navigator.share. */
export async function shareLink(link: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (isNative) {
    try {
      await Share.share({ ...link, dialogTitle: link.title });
      return 'shared';
    } catch (e) {
      // The plugin rejects with "Share canceled" when the sheet is dismissed.
      if (/cancel/i.test((e as Error)?.message ?? '')) return 'cancelled';
    }
  } else {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(link);
        return 'shared';
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(link.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Share the results for a destination. */
export function shareResults(dest: {
  label: string;
  lat: number;
  lng: number;
}): Promise<ShareOutcome> {
  const title = `Carparks near ${dest.label}`;
  return shareLink({ title, text: `${title}, cheapest first`, url: resultsShareUrl(dest) });
}
