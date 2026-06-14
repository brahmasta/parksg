import { useEffect, useState } from 'react';
import { adminFetch, AdminError, type Analytics } from './api';

/* ── Type scale (one deliberate ladder, used everywhere below) ───────────── */
const TYPE = {
  hero: { fontSize: 32, fontWeight: 700, letterSpacing: -1, lineHeight: 1 } as React.CSSProperties,
  metric: { fontSize: 22, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1 } as React.CSSProperties,
  total: { fontSize: 26, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1 } as React.CSSProperties,
  caption: { fontSize: 11.5, fontWeight: 500 } as React.CSSProperties,
};

const card: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '0.5px solid var(--line-strong)',
  borderRadius: 14,
  padding: 20,
  boxShadow: 'var(--shadow-card)',
};
/* Breakdowns sit one tier down: lighter elevation + tighter padding. */
const cardSoft: React.CSSProperties = {
  ...card,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
};
const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-3)',
  marginBottom: 12,
};

export function AdminDashboard({
  token,
  onAuthError,
  onOpenReports,
}: {
  token: string;
  onAuthError: () => void;
  /** Jump to the queue that holds open reports (the Feedback tab). */
  onOpenReports?: () => void;
}) {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [excludeAdmin, setExcludeAdmin] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const url = `/api/admin/analytics?days=${days}${excludeAdmin ? '&exclude_admin=1' : ''}`;
    adminFetch<Analytics>(url, token)
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
  }, [token, days, excludeAdmin, onAuthError]);

  if (loading && !data) return <div style={{ color: 'var(--text-3)', padding: 20 }}>Loading analytics…</div>;
  if (err) return <div style={{ color: 'var(--bad)', padding: 20 }}>{err}</div>;
  if (!data) return null;

  const t = data.totals;
  // Per-day rollups for the headline tiles. Active users isn't additive, so we
  // average the daily-unique series; searches/visits divide the window total.
  const win = Math.max(1, data.window_days);
  const avgDau = data.dau.length
    ? Math.round(data.dau.reduce((s, d) => s + d.users, 0) / data.dau.length)
    : 0;
  const perDay = (n: number) => {
    const v = n / win;
    return v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(1);
  };
  const hasReports = t.reports_open > 0;

  return (
    <div className="psg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Overview</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none' }}
            title="Exclude admin accounts (and their devices) from every metric"
          >
            <input type="checkbox" checked={excludeAdmin} onChange={(e) => setExcludeAdmin(e.target.checked)} />
            Exclude admin
          </label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={selectStyle}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Tier 1 — primary engagement metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Stat label="Active users" value={t.active_users} sub={`${data.window_days}-day unique · ~${avgDau.toLocaleString()}/day`} accent />
        <Stat label="Searches" value={t.searches} sub={`~${perDay(t.searches)}/day · ${t.searches_all_time.toLocaleString()} all-time`} />
        <Stat label="Visits" value={t.visits} sub={`page loads · ~${perDay(t.visits)}/day`} />
      </div>

      {/* Tier 2 — secondary / operational (lighter, smaller) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <MiniStat label="Registered" value={t.registered_users} sub="signed-in accounts" />
        <MiniStat
          label="Open reports"
          value={t.reports_open}
          sub={hasReports ? 'Needs review →' : 'all clear'}
          tone={hasReports ? 'warn' : 'default'}
          onClick={hasReports ? onOpenReports : undefined}
        />
      </div>

      {/* Engagement — the trends lead (hero charts) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GroupHeading>Engagement</GroupHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          <div style={card}>
            <div style={eyebrow}>Daily active users</div>
            <DayBars data={data.dau.map((d) => ({ day: d.day, value: d.users }))} accent />
          </div>
          <div style={card}>
            <div style={eyebrow}>Searches per day</div>
            <DayBars data={data.searches_by_day.map((d) => ({ day: d.day, value: d.count }))} />
          </div>
        </div>
      </section>

      {/* Audience — secondary breakdowns (lighter cards, tinted bars) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GroupHeading>Audience</GroupHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={cardSoft}>
            <div style={eyebrow}>Top searches</div>
            {data.top_searches.length === 0 ? (
              <Empty>No searches in this window.</Empty>
            ) : (
              <Bars rows={data.top_searches.map((d) => ({ label: d.query, value: d.count }))} color="var(--accent)" />
            )}
          </div>
          <div style={cardSoft}>
            <div style={eyebrow}>Device</div>
            {data.device.length === 0 ? (
              <Empty>No device data yet — fills in as visitors arrive.</Empty>
            ) : (
              <Bars rows={data.device.map((d) => ({ label: d.device, value: d.count }))} color="var(--src-ura)" />
            )}
          </div>
          <div style={cardSoft}>
            <div style={eyebrow}>Where visitors come from</div>
            {data.referrers.length === 0 ? (
              <Empty>No referrer data yet — fills in as visitors arrive.</Empty>
            ) : (
              <Bars rows={data.referrers.map((d) => ({ label: d.referrer, value: d.count }))} color="var(--src-lta)" />
            )}
          </div>
        </div>
      </section>
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

/** Section divider: a small mono label with a hairline rule running off to the right. */
function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 0, borderTop: '0.5px solid var(--line)' }} />
    </div>
  );
}

const statLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
  fontFamily: 'var(--font-mono)',
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
      <div style={{ ...statLabel, color: accent ? 'color-mix(in srgb, var(--accent-on) 80%, transparent)' : 'var(--text-3)' }}>{label}</div>
      <div style={{ ...TYPE.hero, marginTop: 10, color: accent ? 'var(--accent-on)' : 'var(--text-1)' }}>{value.toLocaleString()}</div>
      {sub && <div style={{ ...TYPE.caption, marginTop: 7, color: accent ? 'color-mix(in srgb, var(--accent-on) 70%, transparent)' : 'var(--text-2)' }}>{sub}</div>}
    </div>
  );
}

/** Tier-2 stat: smaller number, lighter card; optionally actionable (warn tone). */
function MiniStat({
  label,
  value,
  sub,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: 'default' | 'warn';
  onClick?: () => void;
}) {
  const warn = tone === 'warn';
  const inner = (
    <>
      <div style={{ ...statLabel, color: warn ? 'var(--warn)' : 'var(--text-3)' }}>{label}</div>
      <div style={{ ...TYPE.metric, marginTop: 8, color: warn ? 'var(--warn)' : 'var(--text-1)' }}>{value.toLocaleString()}</div>
      {sub && <div style={{ ...TYPE.caption, marginTop: 6, color: warn ? 'var(--warn)' : 'var(--text-3)' }}>{sub}</div>}
    </>
  );
  const style: React.CSSProperties = {
    ...cardSoft,
    textAlign: 'left',
    width: '100%',
    background: warn ? 'var(--warn-bg)' : 'var(--bg-1)',
    border: warn ? '0.5px solid color-mix(in srgb, var(--warn) 35%, transparent)' : '0.5px solid var(--line-strong)',
    cursor: onClick ? 'pointer' : 'default',
  };
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...style, appearance: 'none', font: 'inherit' }}>
      {inner}
    </button>
  ) : (
    <div style={style}>{inner}</div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '8px 0' }}>{children}</div>;
}

/** Horizontal labelled bars (top-N lists). */
function Bars({ rows, color = 'var(--accent)' }: { rows: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 110, flexShrink: 0, fontSize: 12.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
            {r.label}
          </div>
          <div style={{ flex: 1, height: 14, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
          </div>
          <div style={{ width: 38, flexShrink: 0, textAlign: 'right', fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
            {r.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical day-by-day mini bar chart (the hero trend view). */
function DayBars({ data, accent }: { data: { day: string; value: number }[]; accent?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div style={{ ...TYPE.total, margin: '4px 0 14px', color: 'var(--text-1)' }}>
        {total.toLocaleString()}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 6, letterSpacing: 0 }}>total</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 84 }}>
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
