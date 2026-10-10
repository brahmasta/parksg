/**
 * Best-effort run log for the automated ingest jobs — writes one row per
 * attempt to `ingest_runs` (db/migrations/019) so the data-health check and
 * the admin dashboard can tell "ran and succeeded" from "silently failing".
 *
 * Never throws: a failed log write must not turn a successful ingest into a
 * failed cron, and a missing table (migration not yet applied) only loses the
 * log line.
 *
 * Server-only (service-role key).
 */

export type IngestRun = {
  job: string;
  /** rate_source label the job feeds, e.g. 'URA'. */
  source?: string;
  startedAt: Date;
  ok: boolean;
  rows?: number;
  error?: string;
};

export async function logIngestRun(
  supabaseUrl: string,
  serviceRoleKey: string,
  run: IngestRun,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/ingest_runs`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        job: run.job,
        source: run.source ?? null,
        started_at: run.startedAt.toISOString(),
        ok: run.ok,
        rows: run.rows ?? null,
        error: run.error ? run.error.slice(0, 500) : null,
      }),
    });
  } catch {
    /* logging is best-effort */
  }
}
