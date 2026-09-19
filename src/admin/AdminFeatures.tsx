/**
 * Feature usage — the full roster, one row per feature.
 *
 * The Overview only has room for a summary; this is where a feature is actually
 * judged. Two rules govern how it presents:
 *
 *  1. It states how long tracking has been running, prominently, and refuses to
 *     frame anything as "unused" until there is enough data to say so. The
 *     first version of this panel read "UNTOUCHED — 45 OF 46" one hour after
 *     click tracking shipped, with a caption inviting the reader to decide the
 *     feature was unwanted. Every one of those 45 was merely unobserved.
 *     Absence of evidence is not evidence of absence, and a dashboard that
 *     blurs the two is worse than no dashboard.
 *
 *  2. Nothing here is a ranking of what is popular. The roster comes from
 *     src/lib/featureInventory.ts, so a feature nobody has touched still gets a
 *     row. That is the entire point — a top-N list structurally cannot show it.
 */
import { useEffect, useState } from 'react';
import { adminFetch, AdminError, type Traffic } from './api';
import {
  FEATURES,
  FEATURE_BY_ID,
  formatTrackingAge,
  type Feature,
  type FeatureArea,
} from '../lib/featureInventory';
import { GroupHeading, MiniStat, Empty } from './ui';
import { card, cardSoft, eyebrow, selectStyle } from './uiTokens';

/** Below this, "nobody uses it" is not a conclusion the data can support. */
const CONFIDENCE_CLICKS = 200;
const CONFIDENCE_DAYS = 7;

type Row = Feature & {
  count: number;
  clients: number;
  screens: string[];
  lastSeen: string | null;
};

export function AdminFeatures({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [days, setDays] = useState(30);
  const [excludeAdmin, setExcludeAdmin] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const url = `/api/admin/traffic?days=${days}${excludeAdmin ? '&exclude_admin=1' : ''}`;
    adminFetch<Traffic>(url, token)
      .then((d) => {
        if (!alive) return;
        setTraffic(d);
        setErr(null);
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

  if (loading && !traffic) return <div style={{ color: 'var(--text-3)', padding: 20 }}>Loading feature usage…</div>;
  if (err) return <div style={{ color: 'var(--bad)', padding: 20 }}>{err}</div>;

  const events = traffic?.events ?? null;
  const clicks = events?.ui_clicks ?? [];
  const tracking = events?.tracking;

  // Roll up per feature: an id can be tagged on several controls, and ui_clicks
  // arrives split by screen.
  const byId = new Map<string, { count: number; clients: number; screens: Set<string>; last: string | null }>();
  for (const c of clicks) {
    if (!FEATURE_BY_ID[c.target]) continue; // stale id from an older build
    const cur = byId.get(c.target) ?? { count: 0, clients: 0, screens: new Set<string>(), last: null };
    cur.count += c.count;
    // clients is per (target, screen); summing over-counts anyone who used the
    // same feature on two screens, so take the largest group as a floor.
    cur.clients = Math.max(cur.clients, c.clients);
    if (c.screen) cur.screens.add(c.screen);
    if (c.last_seen && (!cur.last || c.last_seen > cur.last)) cur.last = c.last_seen;
    byId.set(c.target, cur);
  }

  const rows: Row[] = FEATURES.map((f) => {
    const hit = byId.get(f.id);
    return {
      ...f,
      count: hit?.count ?? 0,
      clients: hit?.clients ?? 0,
      screens: hit ? [...hit.screens].sort() : [],
      lastSeen: hit?.last ?? null,
    };
  });

  const used = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const unseen = rows.filter((r) => r.count === 0);

  // How long have we actually been watching? Computed server-side.
  const hoursTracked = tracking?.hours_tracked ?? null;
  const daysTracked = (hoursTracked ?? 0) / 24;
  const totalClicks = tracking?.ui_clicks ?? clicks.reduce((s, c) => s + c.count, 0);
  const confident = totalClicks >= CONFIDENCE_CLICKS && daysTracked >= CONFIDENCE_DAYS;
  const age = formatTrackingAge(hoursTracked);

  const byArea = new Map<FeatureArea, Row[]>();
  for (const r of rows) {
    const list = byArea.get(r.area) ?? [];
    list.push(r);
    byArea.set(r.area, list);
  }

  return (
    <div className="psg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Feature usage</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none' }}
            title="Exclude admin accounts (and their devices)"
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

      {/* The honesty gate. Until there is enough data, say so first and loudly. */}
      {!confident && (
        <div
          style={{
            ...cardSoft,
            background: 'var(--warn-bg)',
            border: '0.5px solid color-mix(in srgb, var(--warn) 35%, transparent)',
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'var(--text-1)',
          }}
        >
          <strong style={{ color: 'var(--warn)' }}>Still collecting — don&apos;t read anything into this yet.</strong>{' '}
          Click tracking has been running for <strong>{age}</strong> and has recorded{' '}
          <strong>{totalClicks.toLocaleString()}</strong> click{totalClicks === 1 ? '' : 's'}. A
          feature with no clicks right now is <em>unobserved</em>, not unwanted — the two look
          identical to a dashboard and only time tells them apart. These numbers become worth acting
          on at roughly {CONFIDENCE_CLICKS.toLocaleString()} clicks across {CONFIDENCE_DAYS}+ days.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <MiniStat label="Features tracked" value={FEATURES.length} sub="from the roster" />
        <MiniStat label="Seen at least once" value={used.length} sub={`of ${FEATURES.length}`} />
        <MiniStat
          label={confident ? 'Unused' : 'Not yet seen'}
          value={unseen.length}
          sub={confident ? 'no clicks in this window' : 'may simply be too early'}
          tone={confident && unseen.length > 0 ? 'warn' : 'default'}
        />
        <MiniStat label="Clicks recorded" value={totalClicks} sub={`tracking for ${age}`} />
      </div>

      {clicks.length === 0 && hoursTracked == null ? (
        <div style={cardSoft}>
          <Empty>
            No clicks recorded yet. {FEATURES.length} features are tagged and waiting; rows fill in
            as people use the app.
          </Empty>
        </div>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GroupHeading>Every feature, by area</GroupHeading>
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {[...byArea.entries()].map(([area, list], ai) => {
              const ordered = [...list].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
              const areaMax = Math.max(1, ...ordered.map((r) => r.count));
              return (
                <div key={area} style={{ borderTop: ai === 0 ? 'none' : '0.5px solid var(--line)' }}>
                  <div style={{ ...eyebrow, margin: 0, padding: '12px 16px 8px', background: 'var(--bg-2)' }}>
                    {area}
                  </div>
                  {ordered.map((r) => (
                    <FeatureRow key={r.id} row={r} max={areaMax} />
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function FeatureRow({ row, max }: { row: Row; max: number }) {
  const zero = row.count === 0;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(80px, 1fr) 56px 56px minmax(96px, 0.9fr)',
        alignItems: 'center',
        gap: 12,
        padding: '9px 16px',
        borderTop: '0.5px solid var(--line)',
        fontSize: 12.5,
        color: zero ? 'var(--text-3)' : 'var(--text-1)',
      }}
    >
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.id}>
        {row.label}
      </div>

      <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${zero ? 0 : Math.max(3, (row.count / max) * 100)}%`,
            height: '100%',
            background: 'var(--src-ura)',
            borderRadius: 999,
          }}
        />
      </div>

      <div style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {zero ? '—' : row.count.toLocaleString()}
      </div>
      <div
        style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)' }}
        title="distinct people (floor — a feature used on two screens counts the larger group)"
      >
        {zero ? '—' : row.clients.toLocaleString()}
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={row.screens.length ? `screens: ${row.screens.join(', ')}` : 'never pressed'}
      >
        {zero ? 'not yet seen' : row.screens.join(' · ') || '—'}
      </div>
    </div>
  );
}
