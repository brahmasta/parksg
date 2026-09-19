/**
 * Audience detail: where real people come from and how far they get.
 *
 * The headline population tiles live in AdminDashboard; this section is the
 * supporting evidence, and the full feature roster lives on its own tab
 * (AdminFeatures) because judging a feature needs room to show how long we have
 * been watching it.
 *
 * The funnel states the cohort it is measured over. app_events began on a
 * specific date while visits/search_events go back months, so an earlier
 * version showed "Searched 345 → Opened a carpark 4, −341 dropped off" when
 * those 341 people simply predated the instrumentation. Nobody abandoned.
 */
import type { Traffic } from './api';
import { FEATURES, FEATURE_BY_ID, formatTrackingAge } from '../lib/featureInventory';
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

export function TrafficSection({
  t,
  onOpenFeatures,
}: {
  t: Traffic;
  /** Jump to the Features tab, where the full roster lives. */
  onOpenFeatures?: () => void;
}) {
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

      <FeatureSummary events={events} onOpenFeatures={onOpenFeatures} />
    </>
  );
}

/**
 * A one-line read on feature coverage, deferring to the Features tab.
 *
 * This deliberately does NOT list untouched features. The earlier version did,
 * under a caption inviting the reader to conclude they were unwanted — one hour
 * after tracking shipped, when all 45 were simply unobserved. Whether absence
 * means anything depends on how long we have been watching, which is a question
 * the Features page has the room to answer properly.
 */
function FeatureSummary({
  events,
  onOpenFeatures,
}: {
  events: Traffic['events'];
  onOpenFeatures?: () => void;
}) {
  const clicks = events?.ui_clicks ?? [];
  const seen = new Set(clicks.map((c) => c.target).filter((t) => FEATURE_BY_ID[t]));
  const totalClicks = events?.tracking?.ui_clicks ?? clicks.reduce((s, c) => s + c.count, 0);
  const age = formatTrackingAge(events?.tracking?.hours_tracked);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <GroupHeading>Feature usage</GroupHeading>
      <div style={cardSoft}>
        <div style={{ fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.6 }}>
          <strong>{seen.size}</strong> of <strong>{FEATURES.length}</strong> tracked features have
          been used, from <strong>{totalClicks.toLocaleString()}</strong> recorded click
          {totalClicks === 1 ? '' : 's'} over <strong>{age}</strong> of tracking.
        </div>
        {onOpenFeatures && (
          <button
            type="button"
            onClick={onOpenFeatures}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '10px 0 0',
              font: 'inherit',
            }}
          >
            See every feature →
          </button>
        )}
      </div>
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
