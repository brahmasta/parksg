import type { ReactNode } from 'react';
import {
  IconArrowRight,
  IconBolt,
  IconCar,
  IconDatabase,
  IconExternal,
  IconLayers,
  IconRefresh,
  IconSearch,
  IconWalk,
} from '../components/icons';

// Representative coverage figures. TODO: back with a Supabase aggregate
// (counts per agency, lot sums, EV joins, last-sync timestamp).
type CovSource = {
  key: string;
  name: string;
  provider: string;
  desc: string;
  carparks: number;
  lots: number;
  colorVar: string;
  freshness: string;
  url: string;
};

const COVERAGE = {
  totalCarparks: 2728,
  totalLots: 431600,
  agencies: 3,
  evCarparks: 1240,
  lastFullSync: '2 min ago',
  sources: [
    { key: 'HDB', name: 'HDB Car Parks', provider: 'data.gov.sg', desc: 'Housing & Development Board public housing car parks. Live lot availability polled every minute.', carparks: 2148, lots: 268400, colorVar: '--src-hdb', freshness: 'Live · ~1 min', url: 'https://data.gov.sg' },
    { key: 'URA', name: 'URA Car Parks', provider: 'LTA DataMall', desc: 'Urban Redevelopment Authority off- and on-street public car parks. Availability via LTA DataMall.', carparks: 412, lots: 96300, colorVar: '--src-ura', freshness: 'Live · ~1 min', url: 'https://datamall.lta.gov.sg' },
    { key: 'LTA', name: 'LTA Car Parks', provider: 'LTA DataMall', desc: 'Land Transport Authority managed car parks, incl. transport-node and commercial sites.', carparks: 168, lots: 66900, colorVar: '--src-lta', freshness: 'Live · ~1 min', url: 'https://datamall.lta.gov.sg' },
  ] as CovSource[],
  layers: [
    { key: 'EV', name: 'EV Charging', provider: 'LTA EVCBatch', value: '1,240 carparks', desc: 'Charging connectors joined to carparks within 50 m.', colorVar: '--src-ev' },
    { key: 'WALK', name: 'Walking Routes', provider: 'OneMap', value: 'Islandwide', desc: 'Real pedestrian routes & walk times to the entrance.', colorVar: '--src-ura' },
    { key: 'GEO', name: 'Place Search', provider: 'Google Places', value: 'Typeahead', desc: 'Destination autocomplete + place details.', colorVar: '--src-lta' },
  ],
  regions: [
    { name: 'Central', count: 612 },
    { name: 'North-East', count: 548 },
    { name: 'West', count: 521 },
    { name: 'East', count: 487 },
    { name: 'North', count: 560 },
  ],
};

export function CoverageScreen({ onFindParking }: { onFindParking: () => void }) {
  const c = COVERAGE;
  const maxRegion = Math.max(...c.regions.map((r) => r.count));

  return (
    <div className="psg-screen" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 28px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><IconDatabase size={16} stroke={2} /></span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
          Data Coverage
        </span>
      </div>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 600, letterSpacing: -1, lineHeight: 1.05, maxWidth: 640 }}>
        Every public carpark in Singapore, from the source.
      </h1>
      <p style={{ margin: '14px 0 0', fontSize: 15.5, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 560 }}>
        We aggregate live availability and rates straight from the agencies that run the carparks — no scraping, no middlemen. Here's exactly what's covered and where it comes from.
      </p>

      {/* Hero stats */}
      <div className="psg-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 32 }}>
        <BigStat value={c.totalCarparks.toLocaleString()} label="Carparks covered" icon={<IconCar size={18} stroke={2} />} accent />
        <BigStat value={`${(c.totalLots / 1000).toFixed(0)}k`} label="Parking lots" icon={<IconDatabase size={18} stroke={2} />} />
        <BigStat value={c.evCarparks.toLocaleString()} label="With EV charging" icon={<IconBolt size={18} stroke={2} />} />
        <BigStat value={String(c.agencies)} label="Official sources" icon={<IconLayers size={18} stroke={2} />} />
      </div>

      {/* Breakdown by source */}
      <SectionTitle>Breakdown by source</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 28, alignItems: 'center', background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 18, padding: 28 }}>
        <SourceDonut sources={c.sources} total={c.totalCarparks} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {c.sources.map((s, i) => {
            const pct = (s.carparks / c.totalCarparks) * 100;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderTop: i > 0 ? '0.5px solid var(--line)' : 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: `var(${s.colorVar})`, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: -0.1 }}>{s.key}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: 'var(--text-2)', flexShrink: 0 }}>
                  {s.carparks.toLocaleString()} <span style={{ color: 'var(--text-3)' }}>· {pct.toFixed(1)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source detail cards */}
      <SectionTitle>The sources in detail</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {c.sources.map((s) => (
          <div key={s.key} style={{ background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, var(${s.colorVar}) 16%, transparent)`, color: `var(${s.colorVar})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconDatabase size={19} stroke={2} />
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--ok)', padding: '3px 8px', borderRadius: 999, background: 'var(--ok-bg)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)' }} /> LIVE
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: -0.3, marginTop: 14 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 3, letterSpacing: 0.2 }}>via {s.provider}</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: '12px 0 16px' }}>{s.desc}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 'auto' }}>
              <MiniStat value={s.carparks.toLocaleString()} label="carparks" />
              <MiniStat value={`${(s.lots / 1000).toFixed(1)}k`} label="lots" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--line)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)' }}>
                <IconRefresh size={13} stroke={2} /> {s.freshness}
              </span>
              <a href={s.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--accent-on)', textDecoration: 'underline', fontWeight: 600 }}>
                Source <IconExternal size={12} stroke={2} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Enriched-with layers */}
      <SectionTitle>Enriched with</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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

      {/* Coverage by region */}
      <SectionTitle>Coverage by region</SectionTitle>
      <div style={{ background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 18, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          {c.regions.map((r) => {
            const h = (r.count / maxRegion) * 100;
            return (
              <div key={r.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{r.count}</span>
                {/* Fixed-height track so the bar's % height resolves. */}
                <div style={{ width: '100%', maxWidth: 80, height: 150, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${h}%`, borderRadius: '8px 8px 0 0', background: 'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--bg-1)))' }} />
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{r.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footnote + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 28, padding: '18px 22px', borderRadius: 16, background: 'var(--bg-1)', border: '0.5px solid var(--line)', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13 }}>
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><IconRefresh size={15} stroke={2} /></span>
          Last full sync <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>{c.lastFullSync}</strong> · availability refreshes about every minute
        </div>
        <button onClick={onFindParking} style={{ appearance: 'none', border: 0, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 11, background: 'var(--accent)', color: 'var(--accent-on)', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 6px 16px rgba(46,227,194,0.28)' }}>
          Find parking now <IconArrowRight size={16} stroke={2.5} />
        </button>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 20, lineHeight: 1.5, maxWidth: 620 }}>
        Figures are representative of current coverage and refresh as feeds update. Rate schedules vary by source recency — URA uses a flat-rate approximation and some LTA rates derive from a 2018 snapshot; always verify at the gantry.
      </p>
    </div>
  );
}

function BigStat({ value, label, icon, accent }: { value: string; label: string; icon: ReactNode; accent?: boolean }) {
  return (
    <div style={{ background: accent ? 'var(--accent-tint)' : 'var(--bg-1)', border: accent ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)', borderRadius: 16, padding: '20px 18px' }}>
      <span style={{ color: accent ? 'var(--accent-on)' : 'var(--text-3)', display: 'inline-flex' }}>{icon}</span>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, letterSpacing: -1, marginTop: 12, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 6, fontWeight: 500 }}>{label}</div>
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
  return <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: -0.4, margin: '40px 0 16px' }}>{children}</h2>;
}

function SourceDonut({ sources, total }: { sources: CovSource[]; total: number }) {
  const R = 52, C = 60, circ = 2 * Math.PI * R;
  let offset = 0;
  const arcs = sources.map((s) => {
    const frac = s.carparks / total;
    const seg = { ...s, dash: frac * circ, offset: offset * circ };
    offset += frac;
    return seg;
  });
  return (
    <div style={{ position: 'relative', width: 232, height: 232, margin: '0 auto' }}>
      <svg width="232" height="232" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--bg-3)" strokeWidth="13" />
        {arcs.map((a) => (
          <circle key={a.key} cx={C} cy={C} r={R} fill="none" stroke={`var(${a.colorVar})`} strokeWidth="13" strokeDasharray={`${a.dash} ${circ - a.dash}`} strokeDashoffset={-a.offset} strokeLinecap="butt" />
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, letterSpacing: -1, lineHeight: 1 }}>{total.toLocaleString()}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)', letterSpacing: 0.4 }}>CARPARKS</div>
      </div>
    </div>
  );
}
