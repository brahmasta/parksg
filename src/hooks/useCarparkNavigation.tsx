import { useCallback, useState } from 'react';
import type { Carpark } from '../lib/types';
import {
  availableProviders,
  getLastProvider,
  mapsDirectionsUrl,
  setLastProvider,
  type MapsProvider,
} from '../lib/maps';
import { isApplePlatform } from '../lib/platform';
import { trackEvent } from '../lib/api/events';
import { NavigateModal } from '../components/NavigateModal';
import { NavigateSheet } from '../components/NavigateSheet';

/**
 * Open driving directions to a carpark's entrance in a maps app, and remember
 * the app for next time. A real anchor click rather than window.open: anchors
 * with target=_blank are never treated as a popup, so they aren't blocked.
 * `from` tells the funnel where the tap came from (detail page or result card).
 */
export function openDirections(cp: Carpark, provider: MapsProvider, from: 'detail' | 'card'): void {
  const [lat, lng] = cp.coords.entrance;
  const a = document.createElement('a');
  a.href = mapsDirectionsUrl(provider, lat, lng);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setLastProvider(provider);
  // Funnel step 5, and the last thing before the user leaves for an external
  // maps app — flush immediately; the page unload would cut a debounce short.
  trackEvent('navigate_clicked', { provider, carpark: cp.id, source: cp.source, from }, { immediate: true });
}

/**
 * Navigate straight from a result card: repeats the last-used maps app, or
 * asks which app the first time. Render `picker` once alongside the list.
 */
export function useCarparkNavigation(variant: 'sheet' | 'modal') {
  const [pending, setPending] = useState<Carpark | null>(null);

  const navigate = useCallback((cp: Carpark) => {
    const last = getLastProvider();
    if (last && availableProviders(isApplePlatform()).includes(last)) {
      openDirections(cp, last, 'card');
    } else {
      setPending(cp);
    }
  }, []);

  const close = useCallback(() => setPending(null), []);
  const pick = useCallback(
    (provider: MapsProvider) => {
      if (pending) openDirections(pending, provider, 'card');
      setPending(null);
    },
    [pending],
  );

  const Picker = variant === 'modal' ? NavigateModal : NavigateSheet;
  const picker = (
    <Picker open={pending != null} onClose={close} carparkName={pending?.name ?? ''} onPick={pick} />
  );

  return { navigate, picker };
}
