import type { ReactNode } from 'react';
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconInfo,
  IconList,
  IconNavigate,
  IconSearch,
} from '../components/icons';

const DATA_SOURCES = ['data.gov.sg', 'LTA DataMall', 'URA Data Service', 'OneMap', 'Google Places'];

const STEPS = [
  { icon: <IconSearch size={18} stroke={2} />, title: 'Search your destination', body: 'Type where you’re headed, or use your location.' },
  { icon: <IconClock size={18} stroke={2} />, title: 'Plan when & how long', body: 'Set a start time and duration — costs are estimated for your exact stay.' },
  { icon: <IconList size={18} stroke={2} />, title: 'Compare by cost & distance', body: 'Nearby carparks ranked live. The cheapest gets a badge.' },
  { icon: <IconNavigate size={18} stroke={2} />, title: 'See the real cost, then go', body: 'Open the entrance in Google Maps, Waze or Apple Maps.' },
];

const WHATS_NEW = [
  'Desktop & tablet layout with a live two-pane map',
  'Plan a start time and duration up to 24 hours',
  'Live lot counts for malls, not just public carparks',
  'Live EV charger availability beside the cheapest lot',
  'Open directions in Google Maps, Waze or Apple Maps',
  'Save carparks & destinations, synced across devices',
];

/** Desktop About — centered column, nav peer of Find/Coverage. */
export function AboutDesktop({ onFindParking, onCoverage }: { onFindParking: () => void; onCoverage: () => void }) {
  return (
    <div className="psg-screen" style={{ maxWidth: 920, margin: '0 auto', padding: '44px 28px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><IconInfo size={16} stroke={2} /></span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>About</span>
      </div>
      <h1 style={{ margin: '14px 0 0', fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 600, letterSpacing: -1, lineHeight: 1.08, maxWidth: 680 }}>
        Find the nearest <span style={{ background: 'var(--accent-tint-strong)', padding: '0 8px', borderRadius: 6 }}>and</span> cheapest carpark, before you start driving.
      </h1>
      <p style={{ margin: '16px 0 0', fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 540 }}>
        No more circling. No more bill shock at the gantry. wheretopark.sg pulls every public carpark’s live availability and rates into one place.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 32 }}>
        <AboutStat value="2,728" label="Carparks covered" />
        <AboutStat value="~60s" label="Live refresh rate" />
        <AboutStat value="$0" label="Free to use" />
      </div>

      <Section title="Why we built this">
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-2)', maxWidth: 720 }}>
          Singapore parking prices are scattered across HDB, URA and private operators — and you usually only see the rate on a signboard <em>after</em> you’ve committed to the ramp. We bring it all into one place, so you compare cost and availability at your destination first.
        </p>
      </Section>

      <Section title="How it works">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ display: 'flex', gap: 14, padding: 18, background: 'var(--bg-1)', border: '0.5px solid var(--line)', borderRadius: 14 }}>
              <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, background: 'var(--accent-tint)', color: 'var(--accent-on)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.2 }}>
                  <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12, marginRight: 6 }}>0{i + 1}</span>{s.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 4 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Where the data comes from">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {DATA_SOURCES.map((src) => (
            <span key={src} style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 14px', borderRadius: 999, border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{src}</span>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55, maxWidth: 700 }}>
          Carpark & availability data © Singapore Land Transport Authority, HDB and URA, under the Singapore Open Data Licence. Rates are estimates — always check the signboard.{' '}
          <button onClick={onCoverage} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--accent-on)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12.5, textDecoration: 'underline' }}>See full coverage →</button>
        </p>
      </Section>

      <Section title="What's new">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px' }}>
          {WHATS_NEW.map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-2)' }}>
              <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: 'var(--accent-tint)', color: 'var(--accent-on)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={12} stroke={2.5} /></span>
              {item}
            </div>
          ))}
        </div>
      </Section>

      <div style={{ marginTop: 36, padding: 28, borderRadius: 18, background: 'var(--accent-tint)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: -0.4, color: 'var(--text-1)' }}>Ready to park smarter?</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>Compare live cost & availability near you.</div>
        </div>
        <button onClick={onFindParking} style={{ appearance: 'none', border: 0, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 22px', borderRadius: 13, background: 'var(--accent)', color: 'var(--accent-on)', fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 8px 22px rgba(46,227,194,0.28)' }}>
          Find parking near me <IconArrowRight size={17} stroke={2.5} />
        </button>
      </div>
    </div>
  );
}

function AboutStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 16, padding: '22px 20px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.8, lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: -0.4, color: 'var(--text-1)' }}>{title}</h2>
      {children}
    </section>
  );
}
