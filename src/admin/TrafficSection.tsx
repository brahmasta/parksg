/**
 * Audience detail: where real people come from, how far they get, and which
 * features go untouched.
 *
 * The headline population tiles live in AdminDashboard; this section is the
 * supporting evidence. Two things here are deliberately awkward rather than
 * tidy:
 *
 *  - The funnel states the cohort it is measured over. app_events began on a
 *    specific date while visits/search_events go back months, so an earlier
 *    version showed "Searched 345 → Opened a carpark 4, −341 dropped off" when
 *    those 341 people simply predated the instrumentation. Nobody abandoned.
 *
 *  - Feature usage is a join against src/lib/featureInventory.ts, not a ranked
 *    list of what was pressed. A ranking can only show what IS used; the
 *    question is what ISN'T, and that can only be answered against a roster of
 *    what exists.
 */
import type { Traffic } from './api';
import { FEATURES, FEATURE_BY_ID, type FeatureArea } from '../lib/featureInventory';
import { GroupHeading, Empty, Bars } from './ui';
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
  const sources = t.sources
    .filter((s) => (s.person ?? 0) > 0)
    .sort((a, b) => (b.person ?? 0) - (a.person ?? 0));
  const events = t.events;
  const basis = t.funnel_basis;

  return (
    <>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GroupHeading>Where real people come from</GroupHeading>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          <div style={cardSoft}>
            <div style={eyebrow}>People by source</div>
            {sources.length === 0 ? (
              <Empty>No classified human traffic in this window.</Empty>
            ) : (
              <>
                <Bars
                  rows={sources.map((s) => ({
                    label: SOURCE_LABEL[s.source] ?? s.source,
                    value: s.person ?? 0,
                  }))}
                  color="var(--src-lta)"
                />
                <div style={{ marginTop: 16 }}>
                  <div style={{ ...eyebrow, marginBottom: 8 }}>…and how many of them search</div>
                  <Bars
                    rows={sources.map((s) => ({
                      label: SOURCE_LABEL[s.source] ?? s.source,
                      value: Math.round(s.pct_person_searched ?? 0),
                    }))}
                    color="var(--accent)"
                    suffix="%"
                  />
                </div>
              </>
            )}
          </div>

          <div style={card}>
            <div style={eyebrow}>Conversion funnel</div>
            {!basis || basis.cohort === 0 ? (
              <Empty>
                No instrumented sessions yet. The funnel measures events from the app itself, which
                begin{t.instrumented_since ? ` on ${t.instrumented_since}` : ' once the tracking ships'}.
              </Empty>
            ) : (
              <>
                <Funnel rows={t.funnel} />
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.55 }}>
                  Measured over{' '}
                  <strong style={{ color: 'var(--text-2)' }}>{basis.cohort.toLocaleString()}</strong>{' '}
                  people whose sessions were instrumented
                  {basis.since ? <> (since {basis.since})</> : null} — not the whole audience, so it
                  is not comparable to the tiles above.
                  {basis.direct_to_carpark > 0 && (
                    <>
                      {' '}
                      A further{' '}
                      <strong style={{ color: 'var(--text-2)' }}>
                        {basis.direct_to_carpark.toLocaleString()}
                      </strong>{' '}
                      went straight to a carpark page without searching
                      {basis.direct_to_navigate > 0 && <> ({basis.direct_to_navigate} of them navigated)</>} —
                      the SEO route, which a step-by-step funnel cannot show.
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <FeatureUsage clicks={events?.ui_clicks ?? []} />
    </>
  );
}

/**
 * Which features get used, and — the point — which do not.
 *
 * Joins the click counts against the full roster in featureInventory.ts, so an
 * untouched feature appears explicitly instead of being invisible by omission.
 */
function FeatureUsage({ clicks }: { clicks: NonNullable<Traffic['events']>['ui_clicks'] }) {
  // A few ids are tagged on more than one control (Save sits on both the detail
  // header and the result card), and ui_clicks is grouped by screen, so roll up.
  const counts = new Map<string, number>();
  for (const c of clicks) {
    if (!FEATURE_BY_ID[c.target]) continue; // stale id from an older build
    counts.set(c.target, (counts.get(c.target) ?? 0) + c.count);
  }

  const used = FEATURES.filter((f) => (counts.get(f.id) ?? 0) > 0)
    .map((f) => ({ ...f, count: counts.get(f.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const unused = FEATURES.filter((f) => (counts.get(f.id) ?? 0) === 0);

  // Group the untouched ones by area — a whole quiet area is a different signal
  // from one quiet button.
  const byArea = new Map<FeatureArea, string[]>();
  for (const f of unused) {
    const list = byArea.get(f.area) ?? [];
    list.push(f.label);
    byArea.set(f.area, list);
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <GroupHeading>Feature usage</GroupHeading>

      {clicks.length === 0 ? (
        <div style={cardSoft}>
          <Empty>
            No interactions recorded yet. {FEATURES.length} features are tracked; counts appear here
            as people use them.
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          <div style={cardSoft}>
            <div style={eyebrow}>
              Used — {used.length} of {FEATURES.length}
            </div>
            {used.length === 0 ? (
              <Empty>Nothing pressed yet in this window.</Empty>
            ) : (
              <Bars
                rows={used.slice(0, 14).map((f) => ({ label: f.label, value: f.count }))}
                color="var(--src-ura)"
              />
            )}
          </div>

          <div style={cardSoft}>
            <div style={eyebrow}>
              Untouched — {unused.length} of {FEATURES.length}
            </div>
            {unused.length === 0 ? (
              <Empty>Every tracked feature was used at least once.</Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...byArea.entries()].map(([area, labels]) => (
                  <div key={area}>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        color: 'var(--text-3)',
                        marginBottom: 4,
                      }}
                    >
                      {area}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      {labels.join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.5 }}>
              Nobody pressed these in this window. Either the feature is not wanted, or it cannot be
              found — worth telling apart before building more.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Funnel: absolute count plus the share of the top step, which is the number
 *  that actually matters when judging a drop-off. */
function Funnel({ rows }: { rows: { step: number; label: string; clients: number; pct: number }[] }) {
  const top = Math.max(1, rows[0]?.clients ?? 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].clients : null;
        const dropped = prev != null && prev > r.clients ? prev - r.clients : 0;
        return (
          <div key={r.step}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--text-1)' }}>{r.label}</span>
              <span
                style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}
              >
                {r.clients.toLocaleString()}
                <span style={{ color: 'var(--text-3)', fontWeight: 500, marginLeft: 6 }}>{r.pct}%</span>
              </span>
            </div>
            <div style={{ height: 16, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(0.5, (r.clients / top) * 100)}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: 999,
                  opacity: 1 - i * 0.14,
                }}
              />
            </div>
            {dropped > 0 && (
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                −{dropped.toLocaleString()} dropped off
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
