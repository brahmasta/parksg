import { Geolocation } from '@capacitor/geolocation';
import { isNative } from './platform';

const failure = (msg: string) => `Could not get your location: ${msg}`;

export type Coords = { latitude: number; longitude: number };

const OPTIONS = { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 };

/** Current position. Native shells use the Capacitor plugin (which prompts for
 *  the OS permission); the web keeps navigator.geolocation. Rejects with an
 *  Error whose message is safe to show the user. */
export async function getCurrentCoords(): Promise<Coords> {
  if (isNative) {
    try {
      const pos = await Geolocation.getCurrentPosition(OPTIONS);
      return pos.coords;
    } catch (err) {
      throw new Error(failure(err instanceof Error ? err.message : String(err)), { cause: err });
    }
  }
  if (!navigator.geolocation) throw new Error('Geolocation is not available on this device.');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error(failure(err.message))),
      OPTIONS,
    );
  });
}
