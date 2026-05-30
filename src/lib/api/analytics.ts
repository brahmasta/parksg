/**
 * Fire-and-forget analytics writes to Supabase.
 *
 * Both calls hit SECURITY DEFINER RPCs (`record_sign_in`, `record_search`)
 * exposed at PostgREST's /rpc endpoint. The underlying profiles +
 * search_events tables are locked under RLS — the browser can only reach
 * them through these two narrow functions, and neither returns any data.
 *
 * Every call swallows its own errors: analytics must never break a sign-in
 * or a search. The anon key is the same one used for carpark reads.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

async function callRpc(fn: string, body: Record<string, unknown>): Promise<void> {
  if (!URL_BASE || !ANON_KEY) return;
  try {
    await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        // We don't need the result row back; keep the response minimal.
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* analytics is best-effort — never surface a failure */
  }
}

/** Upsert the user's profile row and bump their sign-in count. */
export function recordSignIn(user: {
  id: string;
  name?: string;
  email?: string;
}): void {
  void callRpc('record_sign_in', {
    p_user_id: user.id,
    p_name: user.name ?? null,
    p_email: user.email ?? null,
  });
}

/** Log a resolved destination search (label + coords + optional user). */
export function recordSearch(params: {
  query: string;
  lat?: number | null;
  lng?: number | null;
  userId?: string | null;
}): void {
  void callRpc('record_search', {
    p_query: params.query,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_user_id: params.userId ?? null,
  });
}
