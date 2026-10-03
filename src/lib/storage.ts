import { Preferences } from '@capacitor/preferences';
import { isNative } from './platform';

/**
 * Durable storage for the native apps.
 *
 * The app reads localStorage synchronously everywhere. iOS may clear a
 * WebView's localStorage when the phone runs short of space; Capacitor
 * Preferences (UserDefaults / SharedPreferences) is never cleared that way.
 * So in the native shells, values that matter are written to both, and
 * restoreNativeStorage() copies them back into localStorage at boot. On the
 * web both functions reduce to plain localStorage.
 */

/** Keys written through persist(): the visitor's saves, recents, session and
 *  settings. Caches and per-visit ids stay in localStorage only. */
const DURABLE_KEYS = [
  'psg.savedCarparks',
  'psg.savedCarparkSnapshots',
  'psg.savedDestinations',
  'psg.recents',
  'psg.session',
  'psg.appleName',
  'psg.navProvider',
  'psg:theme',
  'psg.viewMode',
  'psg.availableOnly',
  'psg.evOnly',
  'psg.vehicleFilter',
  'psg.cid',
] as const;

export type DurableKey = (typeof DURABLE_KEYS)[number];

/** localStorage.setItem, mirrored to Preferences on native. Throws only if
 *  localStorage does, like the call it replaces. */
export function persist(key: DurableKey, value: string): void {
  if (isNative) void Preferences.set({ key, value }).catch(() => {});
  localStorage.setItem(key, value);
}

/** Native only, awaited before first render: refill localStorage from
 *  Preferences, and copy anything only localStorage has (installs from
 *  before this existed) into Preferences. */
export async function restoreNativeStorage(): Promise<void> {
  if (!isNative) return;
  await Promise.all(
    DURABLE_KEYS.map(async (key) => {
      try {
        const { value } = await Preferences.get({ key });
        const local = localStorage.getItem(key);
        if (value != null && value !== local) localStorage.setItem(key, value);
        else if (value == null && local != null) await Preferences.set({ key, value: local });
      } catch {
        /* a missing value is no worse than before */
      }
    }),
  );
}
