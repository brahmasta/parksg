/**
 * Crowdsourced carpark check-ins → Supabase.
 *
 * Two narrow SECURITY DEFINER RPCs over the RLS-locked `checkins` table (same
 * pattern as analytics.ts / feedback.ts):
 *  - `record_checkin`     — a signed-in driver reports the current state.
 *  - `get_checkin_summary` — aggregated recent signal (last 2h), no PII, anon-ok.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type CheckinStatus = 'available' | 'limited' | 'full';

export type CheckinSummary = {
  /** Distinct reporters in the last 2 hours. */
  total: number;
  available: number;
  limited: number;
  full: number;
  /** Most recent reporter's status (their latest), or null if none. */
  latestStatus: CheckinStatus | null;
  /** ISO timestamp of the most recent report, or null. */
  latestAt: string | null;
};

function headers(): HeadersInit {
  return {
    apikey: ANON_KEY as string,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

/** Submit a check-in. Resolves true when stored, false on any failure. */
export async function submitCheckin(
  carparkId: string,
  status: CheckinStatus,
  userId: string,
): Promise<boolean> {
  if (!URL_BASE || !ANON_KEY) return false;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/record_checkin`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        p_carpark_id: carparkId,
        p_status: status,
        p_user_id: userId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch the aggregated recent crowd signal for a carpark. Null on failure. */
export async function fetchCheckinSummary(
  carparkId: string,
  signal?: AbortSignal,
): Promise<CheckinSummary | null> {
  if (!URL_BASE || !ANON_KEY) return null;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/get_checkin_summary`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ p_carpark_id: carparkId }),
      signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      total?: number;
      available?: number;
      limited?: number;
      full?: number;
      latest_status?: CheckinStatus | null;
      latest_at?: string | null;
    } | null;
    if (!j) return null;
    return {
      total: j.total ?? 0,
      available: j.available ?? 0,
      limited: j.limited ?? 0,
      full: j.full ?? 0,
      latestStatus: j.latest_status ?? null,
      latestAt: j.latest_at ?? null,
    };
  } catch {
    return null;
  }
}
