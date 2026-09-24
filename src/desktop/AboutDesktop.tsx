import type { ReactNode } from 'react';
import { CoverageSections } from '../components/CoverageSections';
import { FOUNDER_NOTE, FOUNDER_NOTE_TITLE, FOUNDER_SIGNOFF, FOUNDER_X_URL } from '../lib/aboutCopy';
import { IconInfo } from '../components/icons';

/** Desktop About — centered column, nav peer of Find. Folds in data coverage. */
export function AboutDesktop() {
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

      <Section title={FOUNDER_NOTE_TITLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
          {FOUNDER_NOTE.map((para) => (
            <p key={para} style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-2)' }}>{para}</p>
          ))}
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-1)', fontWeight: 600 }}>
            {FOUNDER_SIGNOFF}
            <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>
              {' · '}
              <a href={FOUNDER_X_URL} target="_blank" rel="noopener noreferrer" data-track="founder_x_link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Say hi on X (@brahmasta) →</a>
            </span>
          </p>
        </div>
      </Section>

      {/* Data coverage — merged in from the old Coverage page. */}
      <CoverageSections />

      <p style={{ margin: '28px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55, maxWidth: 700 }}>
        Carpark & availability data © Singapore Land Transport Authority, HDB and URA, under the Singapore Open Data Licence. Rates are estimates — always check the signboard.
      </p>
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
