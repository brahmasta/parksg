import { useEffect, useState, useCallback } from 'react';
import { adminFetch, AdminError, type Report } from './api';

const STATUSES = ['new', 'reviewing', 'resolved', 'dismissed'];
const STATUS_COLOR: Record<string, string> = {
  new: 'var(--accent)',
  reviewing: 'var(--warn)',
  resolved: 'var(--ok)',
  dismissed: 'var(--text-3)',
};

export function AdminFeedback({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const qs = filter ? `?status=${filter}` : '';
    adminFetch<{ reports: Report[] }>(`/api/admin/feedback${qs}`, token)
      .then((d) => {
        setReports(d.reports);
        setErr(null);
      })
      .catch((e: AdminError) => (e.status === 401 ? onAuthError() : setErr(e.message)))
      .finally(() => setLoading(false));
  }, [token, filter, onAuthError]);

  useEffect(load, [load]);

  const setStatus = async (id: string, status: string) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      await adminFetch(`/api/admin/feedback`, token, {
        method: 'POST',
        body: JSON.stringify({ id, status }),
      });
    } catch (e) {
      if ((e as AdminError).status === 401) onAuthError();
      else load(); // revert by reloading
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>
          Feedback <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 15 }}>({reports.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                appearance: 'none',
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: filter === s ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
                background: filter === s ? 'var(--accent-tint-strong)' : 'var(--bg-1)',
                color: filter === s ? 'var(--accent)' : 'var(--text-2)',
                textTransform: 'capitalize',
              }}
            >
              {s || 'all'}
            </button>
          ))}
        </div>
      </div>

      {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
      {loading && reports.length === 0 ? (
        <div style={{ color: 'var(--text-3)', padding: 20 }}>Loading…</div>
      ) : reports.length === 0 ? (
        <div style={{ color: 'var(--text-3)', padding: 20 }}>No reports{filter ? ` with status “${filter}”` : ''} yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'var(--bg-1)',
                border: '0.5px solid var(--line-strong)',
                borderRadius: 14,
                padding: 16,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{r.category}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(r.created_at).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>
                    {r.carpark_name}
                    {r.carpark_id ? ` · ${r.carpark_id.toUpperCase()}` : ''}
                    {r.carpark_source ? ` · ${r.carpark_source}` : ''}
                  </div>
                </div>
                <select
                  value={r.status}
                  onChange={(e) => setStatus(r.id, e.target.value)}
                  style={{
                    appearance: 'none',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '0.5px solid var(--line-strong)',
                    background: 'var(--bg-2)',
                    color: STATUS_COLOR[r.status] || 'var(--text-1)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                    textTransform: 'capitalize',
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
                {r.description}
              </p>
              {r.email && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
                  Contact: <a href={`mailto:${r.email}`} style={{ color: 'var(--accent)' }}>{r.email}</a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
