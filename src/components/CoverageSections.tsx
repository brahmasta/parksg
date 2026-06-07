import type { ReactNode } from 'react';
import {
  IconBolt,
  IconCar,
  IconDatabase,
  IconExternal,
  IconLayers,
  IconList,
  IconRefresh,
  IconSearch,
  IconWalk,
} from './icons';

// Real figures from the Supabase carpark database. Verified against live counts
// on 2026-06-06 (they matched exactly — no drift). Refresh with:
//   select count(*) total,
//          count(*) filter (where lat is not null and lng is not null) on_map
//   from carparks;
//   select agency, count(*),
//          count(*) filter (where lat is not null and lng is not null) on_map
//   from carparks group by agency;
type CovSource = {
  key: string;
  name: string;
  provider: string;
  desc: string;
  carparks: number;
  onMap: number;
  colorVar: string;
  freshness: string;
  url: string;
};

const COVERAGE = {
  totalCarparks: 3272,
  onMap: 3016,
  withRates: 3226,
  agencies: 4,
  sources: [
    { key: 'HDB', name: 'HDB Car Parks', provider: 'data.gov.sg', desc: 'Housing & Development Board public housing car parks. Live lot availability + capacity polled every minute.', carparks: 2265, onMap: 2265, colorVar: '--src-hdb', freshness: 'Live · ~1 min', url: 'https://data.gov.sg' },
    { key: 'URA', name: 'URA Car Parks', provider: 'URA Data Service · LTA DataMall', desc: 'Urban Redevelopment Authority off- and on-street car parks. Real tiered rate schedules from URA; availability via DataMall.', carparks: 661, onMap: 660, colorVar: '--src-ura', freshness: 'Live · ~1 min', url: 'https://www.ura.gov.sg/maps/api/' },
    { key: 'LTA', name: 'LTA Car Parks', provider: 'LTA DataMall', desc: 'LTA-managed + commercial/mall car parks. Many live via DataMall; the rest cold-start from a 2018 rate snapshot until curated.', carparks: 318, onMap: 63, colorVar: '--src-lta', freshness: 'Live + 2018 snapshot', url: 'https://datamall.lta.gov.sg' },
    { key: 'JTC', name: 'JTC Car Parks', provider: 'data.gov.sg', desc: 'JTC industrial-estate car parks (Ang Mo Kio, Bukit Merah, Aljunied, Depot Lane). Metadata + coordinates; season-parking sites.', carparks: 28, onMap: 28, colorVar: '--src-ev', freshness: 'Static', url: 'https://data.gov.sg' },
  ] as CovSource[],
  layers: [
    { key: 'EV', name: 'EV Charging', provider: 'LTA EVCBatch', value: 'Live · 5 min', desc: 'Charging connectors joined to carparks within 50 m, with live connector status.', colorVar: '--src-ev' },
    { key: 'WALK', name: 'Walking Routes', provider: 'OneMap', value: 'Islandwide', desc: 'Real pedestrian routes & walk times from the carpark entrance to your destination.', colorVar: '--src-ura' },
    { key: 'GEO', name: 'Place Search', provider: 'Google Places', value: 'Typeahead', desc: 'Destination autocomplete + nearby supplementary carparks where our feeds have gaps.', colorVar: '--src-lta' },
  ],
};

/**
 * The "Data coverage" portion of the About page — hero stats, source breakdown,
 * source detail cards and enrichment layers. Self-contained sections with no
 * outer width constraint, so it drops into both the mobile About scroll body
 * and the desktop About column. Responsive grids collapse on narrow widths.
 */
export function CoverageSections() {
  const c = COVERAGE;
  return (
    <section style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><IconDatabase size={16} stroke={2} /></span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
          Data coverage
        </span>
      </div>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.1, maxWidth: 560 }}>
        Every public carpark in Singapore, from the source.
      </h2>

      {/* Hero stats */}
      <div className="psg-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 24 }}>
        <BigStat value={c.totalCarparks.toLocaleString()} label="Carparks covered" icon={<IconCar size={18} stroke={2} />} accent />
        <BigStat value={c.onMap.toLocaleString()} label="On the map" icon={<IconDatabase size={18} stroke={2} />} />
        <BigStat value={c.withRates.toLocaleString()} label="With rate estimates" icon={<IconList size={18} stroke={2} />} />
        <BigStat value={String(c.agencies)} label="Official sources" icon={<IconLayers size={18} stroke={2} />} />
      </div>

      {/* Breakdown by source */}
      <SectionTitle>Breakdown by source</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, alignItems: 'center', background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 18, padding: 22 }}>
        <SourceDonut sources={c.sources} total={c.totalCarparks} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {c.sources.map((s, i) => {
            const pct = (s.carparks / c.totalCarparks) * 100;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: i > 0 ? '0.5px solid var(--line)' : 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: `var(${s.colorVar})`, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.1 }}>{s.key}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)', flexShrink: 0 }}>
                  {s.carparks.toLocaleString()} <span style={{ color: 'var(--text-3)' }}>· {pct.toFixed(1)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source detail cards */}
      <SectionTitle>The sources in detail</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {c.sources.map((s) => {
          const live = s.freshness.toLowerCase().startsWith('live');
          return (
            <div key={s.key} style={{ background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, var(${s.colorVar}) 16%, transparent)`, color: `var(${s.colorVar})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconDatabase size={19} stroke={2} />
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, color: live ? 'var(--ok)' : 'var(--text-3)', padding: '3px 8px', borderRadius: 999, background: live ? 'var(--ok-bg)' : 'var(--bg-3)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: live ? 'var(--ok)' : 'var(--text-3)' }} /> {live ? 'LIVE' : 'STATIC'}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: -0.3, marginTop: 14 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 3, letterSpacing: 0.2 }}>via {s.provider}</div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: '12px 0 16px' }}>{s.desc}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 'auto' }}>
                <MiniStat value={s.carparks.toLocaleString()} label="carparks" />
                <MiniStat value={s.onMap.toLocaleString()} label="on map" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--line)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)' }}>
                  <IconRefresh size={13} stroke={2} /> {s.freshness}
                </span>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--accent)', textDecoration: 'underline', fontWeight: 600 }}>
                  Source <IconExternal size={12} stroke={2} />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enriched-with layers */}
      <SectionTitle>Enriched with</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {c.layers.map((l) => (
          <div key={l.key} style={{ background: 'var(--bg-1)', border: '0.5px solid var(--line)', borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 13 }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: `color-mix(in srgb, var(${l.colorVar}) 16%, transparent)`, color: `var(${l.colorVar})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {l.key === 'EV' ? <IconBolt size={18} stroke={2} /> : l.key === 'WALK' ? <IconWalk size={18} stroke={2} /> : <IconSearch size={17} stroke={2} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>{l.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{l.value}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>via {l.provider}</div>
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.45, margin: '8px 0 0' }}>{l.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 12.5, marginTop: 22 }}>
        <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><IconRefresh size={15} stroke={2} /></span>
        Counts from the live carpark database · availability refreshes about every minute
      </div>
    </section>
  );
}

function BigStat({ value, label, icon, accent }: { value: string; label: string; icon: ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? 'var(--accent)' : 'var(--bg-1)',
        border: accent ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
        borderRadius: 16,
        padding: '18px 16px',
        boxShadow: accent ? 'var(--shadow-card)' : undefined,
      }}
    >
      <span style={{ color: accent ? 'var(--accent-on)' : 'var(--text-3)', display: 'inline-flex' }}>{icon}</span>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, letterSpacing: -1, marginTop: 10, lineHeight: 1, color: accent ? 'var(--accent-on)' : 'var(--text-1)' }}>{value}</div>
      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 500, color: accent ? 'color-mix(in srgb, var(--accent-on) 78%, transparent)' : 'var(--text-2)' }}>{label}</div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: -0.4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontFamily: 'var(--font-mono)', letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: -0.4, margin: '32px 0 14px' }}>{children}</h3>;
}

function SourceDonut({ sources, total }: { sources: CovSource[]; total: number }) {
  const R = 52, C = 60, circ = 2 * Math.PI * R;
  const fracs = sources.map((s) => s.carparks / total);
  const arcs = sources.map((s, i) => {
    const priorFrac = fracs.slice(0, i).reduce((a, b) => a + b, 0);
    return { ...s, dash: fracs[i] * circ, offset: priorFrac * circ };
  });
  return (
    <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
      <svg width="200" height="200" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--bg-3)" strokeWidth="13" />
        {arcs.map((a) => (
          <circle key={a.key} cx={C} cy={C} r={R} fill="none" stroke={`var(${a.colorVar})`} strokeWidth="13" strokeDasharray={`${a.dash} ${circ - a.dash}`} strokeDashoffset={-a.offset} strokeLinecap="butt" />
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, letterSpacing: -1, lineHeight: 1 }}>{total.toLocaleString()}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)', letterSpacing: 0.4 }}>CARPARKS</div>
      </div>
    </div>
  );
}
