import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { Empty } from './ui';
import { cardSoft, eyebrow } from './uiTokens';
import type { FreshnessReport, Level, Verdict } from '../lib/server/dataFreshness';

type DataHealth = FreshnessReport & { verdicts: Verdict[] };

const TONE: Record<Level, string> = {
  ok: 'var(--text-3)',
  review: 'var(--warn)',
  stale: 'var(--bad)',
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'no data';

/**
 * Per-source rate freshness + latest ingest runs (/api/admin/data-health).
 * Uses the same verdicts as the daily data-health cron, so a red row here is
 * the same thing that failed the cron.
 */
export function DataHealthSection({ token }: { token: string }) {
  const [data, setData] = useState<DataHealth | null>(null);
  // Any failure (404 before migration 019, or a query error) just hides the
  // panel; the cron is what alerts.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    adminFetch<DataHealth>('/api/admin/data-health', token)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [token]);

  if (failed || !data) return null;

  const verdictOf = (source: string) => data.verdicts.find((v) => v.source === source);

  return (
    <div style={cardSoft}>
      <div style={eyebrow}>Data freshness</div>
      {data.sources.length === 0 ? (
        <Empty>No sources.</Empty>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: 'var(--text-3)', textAlign: 'left' }}>
              <th style={th}>Source</th>
              <th style={th}>Rates written (SGT)</th>
              <th style={{ ...th, textAlign: 'right' }}>No rates</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s) => {
              const v = verdictOf(s.source);
              return (
                <tr key={s.source} style={{ borderTop: '0.5px solid var(--line)' }}>
                  <td style={td}>{s.source}</td>
                  <td style={td}>{fmtDate(s.rates_written_at)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {s.carparks_without_rates} / {s.carparks}
                  </td>
                  <td style={{ ...td, color: v ? TONE[v.level] : 'var(--text-3)' }}>
                    {v ? `${v.level} · ${v.reason}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.55 }}>
        {data.runs.length === 0
          ? 'No ingest runs logged yet.'
          : data.runs.map((r) => (
              <div key={r.job}>
                <code>{r.job}</code>: last run {fmtDate(r.finished_at)}{' '}
                {r.ok ? `ok (${r.rows ?? 0} rows)` : `FAILED: ${r.error ?? 'unknown'}`}
                {!r.ok && r.last_ok_at && <> · last success {fmtDate(r.last_ok_at)}</>}
              </div>
            ))}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { fontWeight: 600, padding: '0 8px 6px 0' };
const td: React.CSSProperties = { padding: '6px 8px 6px 0', verticalAlign: 'top' };
