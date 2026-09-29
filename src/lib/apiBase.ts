// Base URL for our own Vercel Edge `/api/*` endpoints. On the web it is empty
// (same-origin, unchanged). In the native shell the page origin is
// capacitor://localhost or https://localhost, so it must point at production.
const BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
