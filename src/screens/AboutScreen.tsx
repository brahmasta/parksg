import type { ReactNode } from 'react';
import { Wordmark } from '../components/Wordmark';
import { CoverageSections } from '../components/CoverageSections';
import {
  IconCheck,
  IconChevronLeft,
  IconList,
  IconNavigate,
  IconSearch,
} from '../components/icons';

type AboutScreenProps = {
  onBack: () => void;
  /** Reuse the Home search entry point so the CTA does something real. */
  onStartSearch?: () => void;
};

const STEPS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <IconSearch size={15} stroke={2} />,
    title: 'Search your destination',
    body: 'Type where you’re headed, or tap “Use my location”.',
  },
  {
    icon: <IconList size={15} stroke={2} />,
    title: 'Compare by cost & distance',
    body: 'Nearby carparks, ranked. The cheapest gets a BEST badge.',
  },
  {
    icon: <IconNavigate size={15} stroke={2} />,
    title: 'See the real cost, then go',
    body: 'Set how long you’ll stay for an estimate, then navigate.',
  },
];

const WHATS_NEW = [
  'Live lot counts for malls, not just public carparks',
  'Verified 2025 rates + map pins for 50+ top malls',
  'Live EV charger availability beside the cheapest lot',
  'Real per-carpark rates with public-holiday pricing',
  'Open directions in Google Maps, Waze or Apple Maps',
  'Save carparks & destinations, synced across devices',
];

export function AboutScreen({ onBack, onStartSearch }: AboutScreenProps) {
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
            <span style={{ color: 'var(--accent-on)', background: 'var(--accent-tint-strong)', padding: '0 4px', borderRadius: 4 }}>
              and
            </span>{' '}
            cheapest carpark, before you start driving.
          </p>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              color: 'var(--text-2)',
              lineHeight: 1.5,
            }}
          >
            No more circling. No more bill shock at the gantry.
          </p>
        </section>

        <Section title="Why we built this">
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: 'var(--text-2)',
            }}
          >
            Singapore parking prices are scattered across HDB, URA and private
            operators — and you usually only see the rate on a signboard{' '}
            <em>after</em> you’ve committed to the ramp. We pull it all into one
            place, so you can compare cost and availability at your destination
            first.
          </p>
        </Section>

        <Section title="How it works">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {STEPS.map((s) => (
              <div key={s.title} style={{ display: 'flex', gap: 12 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: 'var(--accent-tint)',
                    color: 'var(--accent-on)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {s.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                      letterSpacing: -0.1,
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-2)',
                      lineHeight: 1.45,
                      marginTop: 2,
                    }}
                  >
                    {s.body}
                  </div>
                </div>
              </div>
            ))}
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

        <Section title="What's new">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {WHATS_NEW.map((item) => (
              <li
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  fontSize: 13,
                  color: 'var(--text-2)',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: 'var(--accent-tint)',
                    color: 'var(--accent-on)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCheck size={11} stroke={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        {/* CTA */}
        <div style={{ paddingTop: 14 }}>
          <button
            type="button"
            onClick={onStartSearch ?? onBack}
            style={{
              appearance: 'none',
              border: 0,
              width: '100%',
              padding: '14px 18px',
              background: 'var(--accent)',
              color: 'var(--accent-on)',
              borderRadius: 14,
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: -0.1,
              cursor: 'pointer',
              boxShadow: '0 8px 22px rgba(46,227,194,0.28), 0 2px 6px rgba(0,0,0,0.08)',
              minHeight: 48,
            }}
          >
            Find parking near me
          </button>
        </div>
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
