/**
 * Traffic audit — the honest read on who is using the app.
 *
 * The "Active users" tile counts distinct client_id in `visits`, i.e. unique
 * browsers that loaded a page. On this app that is mostly crawlers: the SSR
 * routes (/carpark/<slug>, /parking-near/<area>) get indexed heavily, and
 * those hits land on a deep path, never reach the home screen, never come
 * back and never interact.
 *
 * This section reports those populations separately, shows where the real
 * people come from and how well each source converts, and walks the funnel
 * from visitor through to using navigation. See db migration 007.
 */
import type { Traffic } from './api';
import { GroupHeading, Stat, MiniStat, Empty, Bars } from './ui';
import { card, cardSoft, eyebrow } from './uiTokens';

const SOURCE_LABEL: Record<string, string> = {
  search_engine: 'Search engines',
  direct: 'Direct / typed',
  ai_assistant: 'AI assistants',
  social: 'Social',
  internal: 'Internal',
  other: 'Other sites',
};

export function TrafficSection({ t }: { t: Traffic }) {
  const p = t.populations;
  const botPct = p.visitors > 0 ? Math.round((p.likely_automated / p.visitors) * 100) : 0;
  // Human counts only — the automated bucket would otherwise swamp the chart.
  const humanSources = t.sources.filter((s) => s.human > 0).sort((a, b) => b.human - a.human);
  const events = t.events;
  const hasEventData = !!events && events.totals.events > 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <GroupHeading>Who is actually using this</GroupHeading>

      {botPct >= 20 && (
        <div
          style={{
            ...cardSoft,
            background: 'var(--warn-bg)',
            border: '0.5px solid color-mix(in srgb, var(--warn) 35%, transparent)',
            fontSize: 12.5,
            lineHeight: 1.55,
            color: 'var(--text-1)',
          }}
        >
          <strong style={{ color: 'var(--warn)' }}>{botPct}% of visitors look automated.</strong>{' '}
          {p.likely_automated.toLocaleString()} of {p.visitors.toLocaleString()} clients arrived
          direct on a deep link, never reached the home screen, visited once and never interacted —
          the signature of crawlers indexing the SEO routes. Good for search visibility, but not an
          audience. Everything below excludes them.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Stat label="Real people" value={p.humans} sub={`of ${p.visitors.toLocaleString()} raw visitors`} accent />
        <MiniStat label="Engaged" value={p.engaged} sub="searched or interacted" />
        <MiniStat
          label="Returned in 7d"
          value={t.return_7d.returned}
          sub={`${t.return_7d.pct}% of ${t.return_7d.eligible.toLocaleString()} eligible`}
        />
        <MiniStat
          label="Human page loads"
          value={p.human_page_loads}
          sub={`of ${p.page_loads.toLocaleString()} total`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div style={card}>
          <div style={eyebrow}>Conversion funnel (humans)</div>
          <Funnel rows={t.funnel.map((f) => ({ label: f.label, value: f.clients, pct: f.pct }))} />
          {!hasEventData && (
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
              The last two steps read from the new event stream — they fill in as instrumented
              traffic arrives.
            </div>
          )}
        </div>

        <div style={cardSoft}>
          <div style={eyebrow}>Where real people come from</div>
          {humanSources.length === 0 ? (
            <Empty>No human traffic in this window.</Empty>
          ) : (
            <>
              <Bars
                rows={humanSources.map((s) => ({
                  label: SOURCE_LABEL[s.source] ?? s.source,
                  value: s.human,
                }))}
                color="var(--src-lta)"
              />
              <div style={{ marginTop: 16 }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>…and how many of them search</div>
                <Bars
                  rows={humanSources.map((s) => ({
                    label: SOURCE_LABEL[s.source] ?? s.source,
                    value: Math.round(s.pct_human_searched),
                  }))}
                  color="var(--accent)"
                  suffix="%"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {hasEventData && events && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={cardSoft}>
            <div style={eyebrow}>Top actions</div>
            <Bars
              rows={events.top_events.slice(0, 10).map((e) => ({ label: e.name, value: e.count }))}
              color="var(--src-ura)"
            />
          </div>
          {events.ui_clicks.length > 0 && (
            <div style={cardSoft}>
              <div style={eyebrow}>Feature usage — most pressed</div>
              <Bars
                rows={events.ui_clicks
                  .slice(0, 12)
                  .map((c) => ({ label: c.target, value: c.count }))}
                color="var(--src-lta)"
              />
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
                Every button press is recorded. A control that never appears in
                this list is a feature nobody is using.
              </div>
            </div>
          )}
          {events.navigate_providers.length > 0 && (
            <div style={cardSoft}>
              <div style={eyebrow}>Navigation hand-off</div>
              <Bars
                rows={events.navigate_providers.map((n) => ({ label: n.provider, value: n.count }))}
                color="var(--accent)"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Funnel: absolute count plus the share of the top step, which is the number
 *  that actually matters when judging a drop-off. */
function Funnel({ rows }: { rows: { label: string; value: number; pct: number }[] }) {
  const top = Math.max(1, rows[0]?.value ?? 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].value : null;
        const dropped = prev != null && prev > r.value ? prev - r.value : 0;
        return (
          <div key={r.label}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 5,
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--text-1)' }}>{r.label}</span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text-2)',
                }}
              >
                {r.value.toLocaleString()}
                <span style={{ color: 'var(--text-3)', fontWeight: 500, marginLeft: 6 }}>{r.pct}%</span>
              </span>
            </div>
            <div style={{ height: 16, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(0.5, (r.value / top) * 100)}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: 999,
                  opacity: 1 - i * 0.15,
                }}
              />
            </div>
            {dropped > 0 && (
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--text-3)',
                  marginTop: 3,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                −{dropped.toLocaleString()} dropped off
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
