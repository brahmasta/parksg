/**
 * Service-role Supabase access for the admin API. The service-role key bypasses
 * RLS, so it is read from server-only env (never VITE_*-prefixed) and used only
 * inside these gated admin functions.
 */

const URL_BASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const SB_URL = URL_BASE;

export function hasServiceConfig(): boolean {
  return Boolean(URL_BASE && SERVICE_KEY);
}

export function sbHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
}
