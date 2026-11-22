/**
 * Data-freshness rules — turns the `admin_data_freshness()` report
 * (db/migrations/019) into per-source verdicts.
 *
 * Shared by the daily /api/cron/data-health check and the admin dashboard so
 * both apply the same thresholds. Pure: no I/O, so it is unit-tested directly.
 *
 * Thresholds are per source, because the sources age very differently:
 *
 *   URA         rewritten daily by the cron → stale after 2 days, and any
 *               failed latest run is an alert on its own.
 *   HDB         tariffs change rarely; ingested by hand → a review nudge after
 *               a year. Its carpark list does change (new estates, coupon
 *               carparks converted to EPS): see "upstream" below.
 *   JTC         ingested by hand; flagged only through "upstream".
 *   LTA_DATAGOV the known 2018 CSV snapshot. The UI already labels it as
 *               outdated, so it is reported but never flagged.
 *   everything else (MANUAL curation, COMMUNITY, LTA_DATAMALL) has no
 *   automated feed to fall behind, so it is reported without a verdict.
 *
 * Tight thresholds on slow-moving sources would only create alert noise; the
 * point is to catch the fragile automated job quickly.
 *
 * Upstream: for hand-ingested data.gov.sg sources the report may carry the
 * time the publisher last updated the dataset (upstreamDatasets.ts). If that
 * is later than our own last sync, the source has changed and we have not
 * picked it up: a review nudge for UPSTREAM_GRACE_DAYS, then an alert. An age
 * limit alone would either nag about unchanged data or miss a real change.
 */

export type SourceReport = {
  source: string;
  carparks: number;
  carparks_without_rates: number;
  last_synced: string | null;
  rate_rows: number;
  rated_carparks: number;
  rates_written_at: string | null;
  rates_effective_from: string | null;
};

export type RunReport = {
  job: string;
  source: string | null;
  started_at: string;
  finished_at: string;
  ok: boolean;
  rows: number | null;
  error: string | null;
  last_ok_at: string | null;
};

export type FreshnessReport = {
  generated_at: string;
  sources: SourceReport[];
  runs: RunReport[];
  /** source → ISO time its publisher last updated the dataset, when known. */
  upstream?: Record<string, string>;
};

/** How long a changed source may wait for a hand-run sync before it alerts. */
export const UPSTREAM_GRACE_DAYS = 7;

/** ok = fine; review = worth a look, no alert; stale = alert. */
export type Level = 'ok' | 'review' | 'stale';

export type Verdict = {
  source: string;
  level: Level;
  /** Age of the newest rate write, in days (null when never written). */
  ratesAgeDays: number | null;
  reason: string;
};

type Rule = { staleAfterDays?: number; reviewAfterDays?: number; job?: string };

export const RULES: Record<string, Rule> = {
  URA: { staleAfterDays: 2, job: 'ura-rates-ingest' },
  HDB: { reviewAfterDays: 365 },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ageDays(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

function upstreamBehind(
  s: SourceReport,
  upstreamUpdatedAt: string | undefined,
  now: Date,
): { level: Level; reason: string } | null {
  if (!upstreamUpdatedAt) return null;
  const updated = Date.parse(upstreamUpdatedAt);
  const synced = s.last_synced ? Date.parse(s.last_synced) : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(updated) || updated <= synced) return null;
  const waiting = Math.floor((now.getTime() - updated) / DAY_MS);
  return {
    level: waiting > UPSTREAM_GRACE_DAYS ? 'stale' : 'review',
    reason:
      `source updated ${upstreamUpdatedAt.slice(0, 10)}, ` +
      `last synced ${s.last_synced ? s.last_synced.slice(0, 10) : 'never'}; run the ${s.source} sync`,
  };
}

export function evaluateFreshness(report: FreshnessReport, now = new Date()): Verdict[] {
  return report.sources.map((s) => {
    const rule = RULES[s.source];
    const age = ageDays(s.rates_written_at, now);
    const base = { source: s.source, ratesAgeDays: age };

    // The publisher changed the dataset after our last sync.
    const behind = upstreamBehind(s, report.upstream?.[s.source], now);
    if (behind) return { ...base, ...behind };

    if (!rule) return { ...base, level: 'ok' as const, reason: 'no automated feed' };

    if (rule.job) {
      const run = report.runs.find((r) => r.job === rule.job);
      if (run && !run.ok) {
        return {
          ...base,
          level: 'stale' as const,
          reason: `last ${rule.job} run failed: ${run.error ?? 'unknown error'}`,
        };
      }
    }

    if (rule.staleAfterDays !== undefined) {
      if (age === null) return { ...base, level: 'stale' as const, reason: 'no rate rows' };
      if (age > rule.staleAfterDays) {
        return {
          ...base,
          level: 'stale' as const,
          reason: `rates last written ${age} days ago (limit ${rule.staleAfterDays})`,
        };
      }
    }

    if (rule.reviewAfterDays !== undefined && age !== null && age > rule.reviewAfterDays) {
      return {
        ...base,
        level: 'review' as const,
        reason: `rates last written ${age} days ago; re-verify tariffs`,
      };
    }

    return { ...base, level: 'ok' as const, reason: 'fresh' };
  });
}
