/**
 * Carpark data-inaccuracy reports → Supabase.
 *
 * Posts to the `record_inaccuracy_report` SECURITY DEFINER RPC (same pattern as
 * analytics.ts): the underlying `inaccuracy_reports` table is RLS-locked, so the
 * browser can only insert through this narrow function, which returns no data.
 * The owner reads submissions from the Supabase dashboard.
 *
 * Unlike fire-and-forget analytics, the form needs to know whether the write
 * landed, so this awaits the request and reports success via the HTTP status.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type InaccuracyReport = {
  carparkName: string;
  category: string;
  description: string;
  carparkId?: string | null;
  carparkSource?: string | null;
  email?: string | null;
};

/** Submit a report. Resolves true when stored, false on any failure. */
export async function submitInaccuracyReport(
  report: InaccuracyReport,
): Promise<boolean> {
  if (!URL_BASE || !ANON_KEY) return false;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/record_inaccuracy_report`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_carpark_name: report.carparkName,
        p_category: report.category,
        p_description: report.description,
        p_carpark_id: report.carparkId ?? null,
        p_carpark_source: report.carparkSource ?? null,
        p_email: report.email ?? null,
        p_user_agent:
          typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
