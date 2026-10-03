// Base URL for our own Vercel Edge `/api/*` endpoints. On the web it is empty
// (same-origin, unchanged). In the native shell the page origin is
// capacitor://localhost or https://localhost, so it must point at production.
// `env` is absent outside Vite (tsx unit tests), hence the optional chain.
const BASE = ((import.meta.env?.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

/** Origin for links people share. The native shell's own origin is
 *  https://localhost or capacitor://localhost, which means nothing to the
 *  recipient, so share the production site there instead. */
export function siteOrigin(): string {
  return BASE || window.location.origin;
}
