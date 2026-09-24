import type { ReactNode } from 'react';
import { Wordmark } from '../components/Wordmark';
import { CoverageSections } from '../components/CoverageSections';
import { FOUNDER_NOTE, FOUNDER_NOTE_TITLE, FOUNDER_SIGNOFF, FOUNDER_X_URL } from '../lib/aboutCopy';
import { IconChevronLeft } from '../components/icons';

type AboutScreenProps = {
  onBack: () => void;
};

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div
      className="psg-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: '52px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          data-track="nav_back"
          style={{
            appearance: 'none',
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--bg-1)',
            border: '0.5px solid var(--line-strong)',
            color: 'var(--text-1)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconChevronLeft size={18} stroke={2} />
        </button>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--text-3)',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          About
        </span>
      </div>

      {/* Scroll body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        {/* Hero */}
        <section style={{ paddingTop: 18, paddingBottom: 14 }}>
          <div style={{ marginBottom: 14 }}>
            <Wordmark size={19} />
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.4,
              lineHeight: 1.2,
            }}
          >
            Find the nearest{' '}
            <span style={{ color: 'var(--accent)', background: 'var(--accent-tint-strong)', padding: '0 4px', borderRadius: 4 }}>
              and
            </span>{' '}
            cheapest carpark, before you start driving.
          </p>
        </section>

        <Section title={FOUNDER_NOTE_TITLE}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FOUNDER_NOTE.map((para) => (
              <p
                key={para}
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: 'var(--text-2)',
                }}
              >
                {para}
              </p>
            ))}
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--text-1)',
                fontWeight: 600,
              }}
            >
              {FOUNDER_SIGNOFF}
            </p>
            <a
              href={FOUNDER_X_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-track="founder_x_link"
              style={{
                alignSelf: 'flex-start',
                fontSize: 13.5,
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Say hi on X (@brahmasta) →
            </a>
          </div>
        </Section>

        {/* Data coverage — merged in from the old Coverage screen. */}
        <CoverageSections />

        <Section title="Licence">
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: 'var(--text-3)',
              lineHeight: 1.5,
            }}
          >
            Carpark &amp; availability data © Singapore Land Transport
            Authority, HDB and URA, under the Singapore Open Data Licence. Rates
            are estimates — always check the signboard.
          </p>
        </Section>
      </div>
    </div>
  );
}

/* ── Small local helpers ──────────────────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ paddingTop: 22 }}>
      <h2
        style={{
          margin: '0 0 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          fontWeight: 500,
          color: 'var(--text-3)',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
