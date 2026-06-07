/**
 * Fire-and-forget analytics writes to Supabase.
 *
 * All calls hit SECURITY DEFINER RPCs (`record_sign_in`, `record_search`,
 * `record_visit`) exposed at PostgREST's /rpc endpoint. The underlying
 * profiles / search_events / visits tables are locked under RLS — the browser
 * can only reach them through these narrow functions, and none return data.
 *
 * Every call swallows its own errors: analytics must never break a sign-in,
 * search, or page load. The anon key is the same one used for carpark reads.
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
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* analytics is best-effort — never surface a failure */
  }
}

// ── Anonymous client identity + request context (for DAU / device / source) ──

const CID_KEY = 'psg.cid';

/** A stable anonymous id for this browser, used to count distinct daily users
 *  without any personal data. Persisted in localStorage. */
export function getClientId(): string | null {
  try {
    let id = localStorage.getItem(CID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(CID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Coarse device class from UA + viewport. */
function getDevice(): string {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'mobile';
  if (typeof window !== 'undefined' && window.innerWidth < 768) return 'mobile';
  return 'desktop';
}

/** Referrer host only (no full URLs / query strings) — 'direct' or 'internal'. */
function getReferrer(): string {
  try {
    const r = document.referrer;
    if (!r) return 'direct';
    const u = new URL(r);
    if (u.hostname === window.location.hostname) return 'internal';
    return u.hostname;
  } catch {
    return 'direct';
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
    p_client_id: getClientId(),
    p_device: getDevice(),
  });
}

// One visit per page load (guard against React StrictMode double-mount in dev).
let visitRecorded = false;

/** Log a visit once per app load — powers daily-active-users, device split and
 *  referrer ("where users come from") for all visitors, not just searchers. */
export function recordVisit(userId?: string | null): void {
  if (visitRecorded) return;
  visitRecorded = true;
  void callRpc('record_visit', {
    p_client_id: getClientId(),
    p_device: getDevice(),
    p_referrer: getReferrer(),
    p_user_id: userId ?? null,
    p_path: typeof window !== 'undefined' ? window.location.pathname : null,
  });
}
