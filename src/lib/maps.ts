/**
 * Multi-provider driving-directions deep links + last-used-provider memory.
 *
 * All three providers use universal https links so they open the native app
 * when installed and fall back to the web map otherwise. The destination is the
 * carpark entrance [lat, lng].
 */

export type MapsProvider = 'google' | 'waze' | 'apple';

export const MAPS_PROVIDERS: readonly MapsProvider[] = ['google', 'waze', 'apple'];

export const MAPS_PROVIDER_LABELS: Record<MapsProvider, string> = {
  google: 'Google Maps',
  waze: 'Waze',
  apple: 'Apple Maps',
};

/** Driving-directions URL to [lat, lng] for the given provider. */
export function mapsDirectionsUrl(provider: MapsProvider, lat: number, lng: number): string {
  const ll = `${lat},${lng}`;
  switch (provider) {
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`;
    case 'waze':
      return `https://waze.com/ul?ll=${ll}&navigate=yes`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${ll}&dirflg=d`;
  }
}

/** Providers offered on this platform — Apple Maps only on Apple devices. */
export function availableProviders(isApple: boolean): MapsProvider[] {
  return isApple ? ['google', 'waze', 'apple'] : ['google', 'waze'];
}

/** Narrow an arbitrary string to a MapsProvider, or null. The testable core of
 *  the localStorage round-trip below. */
export function parseProvider(raw: string | null | undefined): MapsProvider | null {
  return raw && (MAPS_PROVIDERS as readonly string[]).includes(raw)
    ? (raw as MapsProvider)
    : null;
}

const LAST_PROVIDER_KEY = 'psg.navProvider';

/** The user's last-used navigation app, or null if none/invalid. */
export function getLastProvider(): MapsProvider | null {
  try {
    return parseProvider(localStorage.getItem(LAST_PROVIDER_KEY));
  } catch {
    return null;
  }
}

/** Remember the user's navigation app for next time (best-effort). */
export function setLastProvider(provider: MapsProvider): void {
  try {
    localStorage.setItem(LAST_PROVIDER_KEY, provider);
  } catch {
    /* ignore quota / disabled storage */
  }
}
