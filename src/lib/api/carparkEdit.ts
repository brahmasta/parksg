/**
 * Community carpark edit proposals → Supabase.
 *
 * Posts to the `submit_carpark_edit` SECURITY DEFINER RPC (same pattern as
 * feedback.ts): the `carpark_edit_submissions` table is RLS-locked, so the
 * browser can only insert through this narrow function. Open to everyone —
 * signed-in users pass their account identity, anonymous users pass typed
 * contact details. An admin reviews every proposal before it's applied.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** A single proposed rate band, in the DB/cents shape the admin applies. */
export type ProposedRate = {
  day_type: 'WEEKDAY' | 'SAT' | 'SUN_PH';
  start_time: string | null;
  end_time: string | null;
  first_hour_cents: number | null;
  per_block_cents: number | null;
  block_minutes: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: string;
};

export type CarparkEditSubmission = {
  carparkId: string;
  carparkName: string;
  carparkSource?: string | null;
  totalLots: number | null;
  rates: ProposedRate[];
  note?: string | null;
  // Submitter identity — from the session when signed in, typed otherwise.
  userId?: string | null;
  email?: string | null;
  name?: string | null;
};

/** Submit a proposed edit. Resolves true when stored, false on any failure. */
export async function submitCarparkEdit(s: CarparkEditSubmission): Promise<boolean> {
  if (!URL_BASE || !ANON_KEY) return false;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/submit_carpark_edit`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_carpark_id: s.carparkId,
        p_carpark_name: s.carparkName,
        p_carpark_source: s.carparkSource ?? null,
        p_user_id: s.userId ?? null,
        p_email: s.email ?? null,
        p_name: s.name ?? null,
        p_total_lots: s.totalLots,
        p_rates: s.rates,
        p_note: s.note ?? null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
