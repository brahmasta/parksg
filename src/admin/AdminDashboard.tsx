import { useEffect, useState } from 'react';
import { adminFetch, AdminError, type Analytics } from './api';

const card: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '0.5px solid var(--line-strong)',
  borderRadius: 14,
  padding: 18,
  boxShadow: 'var(--shadow-card)',
};
const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-3)',
};

export function AdminDashboard({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    adminFetch<Analytics>(`/api/admin/analytics?days=${days}`, token)
      .then((d) => {
        if (alive) {
          setData(d);
          setErr(null);
        }
      })
      .catch((e: AdminError) => {
        if (!alive) return;
        if (e.status === 401) onAuthError();
        else setErr(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token, days, onAuthError]);

  if (loading && !data) return <div style={{ color: 'var(--text-3)', padding: 20 }}>Loading analytics…</div>;
  if (err) return <div style={{ color: 'var(--bad)', padding: 20 }}>{err}</div>;
  if (!data) return null;

  const t = data.totals;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Overview</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Stat label="Active users" value={t.active_users} sub={`${data.window_days}-day unique`} accent />
        <Stat label="Searches" value={t.searches} sub={`${t.searches_all_time.toLocaleString()} all-time`} />
        <Stat label="Visits" value={t.visits} sub="page loads" />
        <Stat label="Registered" value={t.registered_users} sub="signed-in accounts" />
        <Stat label="Open reports" value={t.reports_open} sub="needs review" />
      </div>

      {/* Daily series */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={card}>
          <div style={eyebrow}>Daily active users</div>
          <DayBars data={data.dau.map((d) => ({ day: d.day, value: d.users }))} accent />
        </div>
        <div style={card}>
          <div style={eyebrow}>Searches per day</div>
          <DayBars data={data.searches_by_day.map((d) => ({ day: d.day, value: d.count }))} />
        </div>
      </div>

      {/* Device + referrers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={card}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Device</div>
          {data.device.length === 0 ? (
            <Empty>No device data yet — fills in as visitors arrive.</Empty>
          ) : (
            <Bars rows={data.device.map((d) => ({ label: d.device, value: d.count }))} />
          )}
        </div>
        <div style={card}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Where visitors come from</div>
          {data.referrers.length === 0 ? (
            <Empty>No referrer data yet — fills in as visitors arrive.</Empty>
          ) : (
            <Bars rows={data.referrers.map((d) => ({ label: d.referrer, value: d.count }))} />
          )}
        </div>
      </div>

      {/* Top searches */}
      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 12 }}>Top searches</div>
        {data.top_searches.length === 0 ? (
          <Empty>No searches in this window.</Empty>
        ) : (
          <Bars rows={data.top_searches.map((d) => ({ label: d.query, value: d.count }))} />
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  appearance: 'none',
  padding: '8px 12px',
  borderRadius: 10,
  border: '0.5px solid var(--line-strong)',
  background: 'var(--bg-1)',
  color: 'var(--text-1)',
  fontSize: 13,
  cursor: 'pointer',
};

function Stat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div
      style={{
        ...card,
        background: accent ? 'var(--accent)' : 'var(--bg-1)',
        border: accent ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: accent ? 'color-mix(in srgb, var(--accent-on) 80%, transparent)' : 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, marginTop: 8, lineHeight: 1, color: accent ? 'var(--accent-on)' : 'var(--text-1)' }}>
        {value.toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: 11.5, marginTop: 6, color: accent ? 'color-mix(in srgb, var(--accent-on) 70%, transparent)' : 'var(--text-2)' }}>{sub}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '8px 0' }}>{children}</div>;
}

/** Horizontal labelled bars (top-N lists). */
function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 120, flexShrink: 0, fontSize: 12.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
            {r.label}
          </div>
          <div style={{ flex: 1, height: 16, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
          </div>
          <div style={{ width: 38, flexShrink: 0, textAlign: 'right', fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
            {r.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical day-by-day mini bar chart. */
function DayBars({ data, accent }: { data: { day: string; value: number }[]; accent?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, margin: '6px 0 10px' }}>
        {total.toLocaleString()}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 6 }}>total</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
        {data.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.value}`}
            style={{
              flex: 1,
              height: `${Math.max(2, (d.value / max) * 100)}%`,
              background: accent ? 'var(--accent)' : 'var(--text-3)',
              borderRadius: 2,
              minWidth: 2,
              opacity: d.value === 0 ? 0.25 : 1,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        <span>{data[0]?.day.slice(5)}</span>
        <span>{data[data.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}
