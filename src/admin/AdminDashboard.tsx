import { useEffect, useState } from 'react';
import { adminFetch, AdminError, type Analytics, type Traffic } from './api';

import { TrafficSection } from './TrafficSection';
import { GroupHeading, Stat, MiniStat, Empty, Bars } from './ui';
import { TYPE, card, cardSoft, eyebrow, selectStyle } from './uiTokens';

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
  const [traffic, setTraffic] = useState<Traffic | null>(null);
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

  // The traffic audit loads independently: it is slower (it classifies every
  // client in the window) and must never hold up the headline tiles.
  useEffect(() => {
    let alive = true;
    const url = `/api/admin/traffic?days=${days}${excludeAdmin ? '&exclude_admin=1' : ''}`;
    adminFetch<Traffic>(url, token)
      .then((d) => {
        if (alive) setTraffic(d);
      })
      .catch(() => {
        /* non-fatal: the rest of the dashboard still renders */
      });
    return () => {
      alive = false;
    };
  }, [token, days, excludeAdmin]);

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

      {/* Reality check — what the tiles above mean once crawler traffic on
          the SSR/SEO routes is separated out. */}
      {traffic && <TrafficSection t={traffic} />}

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
