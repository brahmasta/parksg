import { useEffect, useState } from 'react';
import { adminFetch, AdminError, type Analytics, type Traffic } from './api';

import { TrafficSection } from './TrafficSection';
import { GroupHeading, Stat, MiniStat, Empty, Bars } from './ui';
import { TYPE, card, cardSoft, eyebrow, selectStyle } from './uiTokens';

/**
 * The Overview.
 *
 * Every headline number here describes REAL PEOPLE, as a per-day average.
 * The earlier version led with "Active users 6,034 — 30-day unique", which was
 * wrong twice over: a 30-day total sitting under a per-day caption, and roughly
 * three quarters of it crawlers indexing the SSR/SEO routes. Automated traffic
 * now has its own section instead of being folded into the same tiles, and the
 * genuinely ambiguous middle is reported rather than assigned to either side.
 *
 * Two endpoints feed this page, and they must never state the same fact twice:
 *   /api/admin/traffic    audience, classification, funnel, feature usage
 *   /api/admin/analytics  registered accounts, open reports, top searches
 */
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
    const qs = `days=${days}${excludeAdmin ? '&exclude_admin=1' : ''}`;

    // Both in flight together. The page's headline numbers come from /traffic,
    // so resolving /analytics first would flash a half-empty Overview.
    void Promise.allSettled([
      adminFetch<Analytics>(`/api/admin/analytics?${qs}`, token),
      adminFetch<Traffic>(`/api/admin/traffic?${qs}`, token),
    ])
      .then(([a, tr]) => {
        if (!alive) return;
        if (a.status === 'fulfilled') {
          setData(a.value);
          setErr(null);
        } else {
          const e = a.reason as AdminError;
          if (e?.status === 401) {
            onAuthError();
            return;
          }
          setErr(e?.message ?? 'Failed to load analytics.');
        }
        // The traffic audit is the slower, heavier query. If it fails, the rest
        // of the page is still useful — degrade to a missing section.
        setTraffic(tr.status === 'fulfilled' ? tr.value : null);
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
  const hasReports = t.reports_open > 0;

  const people = traffic?.people;
  const bots = traffic?.bots;
  const uncertain = traffic?.uncertain;
  const series = traffic?.series;
  // Today is in-flight, so it is charted but excluded from every mean.
  const completeDays = traffic?.complete_days ?? Math.max(1, days - 1);
  const perDay = `avg/day over ${completeDays} full day${completeDays === 1 ? '' : 's'}`;
  const num = (v: number | null | undefined) => (v == null ? 0 : v);

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

      {/* ── People: the only numbers that describe an audience ─────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GroupHeading>Real people · per day</GroupHeading>

        {!people ? (
          <div style={cardSoft}>
            <Empty>
              Audience data unavailable — the traffic audit failed to load. The
              operational numbers below are unaffected.
            </Empty>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <Stat label="Daily active people" value={num(people.avg_dau)} sub={perDay} accent />
              <Stat label="Daily searches" value={num(people.avg_searches)} sub={perDay} />
              <Stat label="Daily visits" value={num(people.avg_visits)} sub={perDay} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <MiniStat
                label="People reached"
                value={people.clients}
                sub={`unique over ${traffic?.window_days ?? days} days`}
              />
              <MiniStat label="Engaged" value={people.engaged} sub="searched or interacted" />
              <MiniStat
                label="Returned in 7d"
                value={traffic?.return_7d?.returned ?? 0}
                sub={`${traffic?.return_7d?.pct ?? 0}% of ${(traffic?.return_7d?.eligible ?? 0).toLocaleString()} eligible`}
              />
              <MiniStat label="Registered" value={t.registered_users} sub="signed-in accounts" />
            </div>

            {series && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                <div style={card}>
                  <div style={eyebrow}>Daily active people</div>
                  <DayBars data={series.people_dau} accent />
                </div>
                <div style={card}>
                  <div style={eyebrow}>Searches per day</div>
                  <DayBars data={series.people_searches} />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Bots & crawlers: kept entirely apart from the audience ─────────── */}
      {bots && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GroupHeading>Bots &amp; crawlers · counted separately</GroupHeading>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <MiniStat label="Daily bot visits" value={num(bots.avg_visits)} sub={perDay} />
            <MiniStat label="Crawler clients" value={bots.clients} sub="direct · deep link · one visit" />
            <MiniStat label="Uncertain" value={uncertain?.clients ?? 0} sub="search-engine deep landings" />
            <MiniStat
              label="All page loads"
              value={traffic?.totals?.page_loads ?? 0}
              sub="people + bots + uncertain"
            />
          </div>

          {series && (
            <div style={cardSoft}>
              <div style={eyebrow}>Bot visits per day</div>
              <DayBars data={series.bot_visits} />
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.55 }}>
                Crawlers indexing <code>/carpark/…</code> and <code>/parking-near/…</code>. They
                arrive direct on a deep link, never reach the home screen, visit once and never
                interact. Good for search visibility — but not an audience, so they are counted here
                and nowhere else.{' '}
                <strong style={{ color: 'var(--text-2)' }}>Uncertain</strong> fits neither pattern:
                mostly search-engine landings that read a rate and left. That may well be a satisfied
                person, so it is reported rather than assigned to either side.
              </div>
            </div>
          )}
        </section>
      )}

      {/* Audience detail, conversion funnel and feature usage. */}
      {traffic && <TrafficSection t={traffic} />}

      {/* ── Operational ───────────────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GroupHeading>Operations</GroupHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <MiniStat
            label="Open reports"
            value={t.reports_open}
            sub={hasReports ? 'Needs review →' : 'all clear'}
            tone={hasReports ? 'warn' : 'default'}
            onClick={hasReports ? onOpenReports : undefined}
          />
          <div style={cardSoft}>
            <div style={eyebrow}>Top searches</div>
            {data.top_searches.length === 0 ? (
              <Empty>No searches in this window.</Empty>
            ) : (
              <Bars rows={data.top_searches.map((d) => ({ label: d.query, value: d.count }))} color="var(--accent)" />
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
