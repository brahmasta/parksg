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
  loc: Pick<Location, 'origin' | 'pathname'> = window.location,
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

/** Native share sheet where available, else copy the link. */
export async function shareResults(dest: {
  label: string;
  lat: number;
  lng: number;
}): Promise<ShareOutcome> {
  const url = resultsShareUrl(dest);
  const title = `Carparks near ${dest.label}`;
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text: `${title}, cheapest first`, url });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
