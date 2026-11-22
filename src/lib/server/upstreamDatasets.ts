/**
 * When each data.gov.sg dataset we ingest by hand was last updated by its
 * publisher. The data-health check compares this with our own last sync, so
 * "the source changed and we have not picked it up" is flagged, without
 * nagging about sources that simply have not changed.
 *
 * Read-only and best-effort: a failed lookup yields no entry for that source,
 * and the freshness rules then say nothing about it.
 */

/** rate_source label → data.gov.sg dataset id (as scripts/migrate-to-supabase.ts). */
export const UPSTREAM_DATASETS: Record<string, string> = {
  HDB: 'd_23f946fa557947f93a8043bbef41dd09',
  JTC: 'd_3b0c377cde41041c93f893d0a92e9fe7',
};

const METADATA_URL = 'https://api-production.data.gov.sg/v2/public/api/datasets';
const TIMEOUT_MS = 6_000;

/** source → ISO time the publisher last updated the dataset. */
export type UpstreamUpdates = Record<string, string>;

export async function fetchUpstreamUpdates(
  datasets: Record<string, string> = UPSTREAM_DATASETS,
): Promise<UpstreamUpdates> {
  const entries = await Promise.all(
    Object.entries(datasets).map(async ([source, id]) => {
      try {
        const res = await fetch(`${METADATA_URL}/${id}/metadata`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: { lastUpdatedAt?: string } };
        const updated = body.data?.lastUpdatedAt;
        return updated && Number.isFinite(Date.parse(updated)) ? ([source, updated] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
}
