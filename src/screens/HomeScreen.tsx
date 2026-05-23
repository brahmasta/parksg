import type { DurationHours, RecentDestination } from '../lib/types';
import { DurationStrip, SearchField } from '../components/atoms';
import { Wordmark } from '../components/Wordmark';
import { IconChevronRight, IconHistory, IconLocation, IconPin } from '../components/icons';

export function HomeScreen({
  destination,
  setDestination,
  duration,
  setDuration,
  onSearch,
  onNearMe,
  recents,
  nearMeBusy,
}: {
  destination: string;
  setDestination: (v: string) => void;
  duration: DurationHours;
  setDuration: (v: DurationHours) => void;
  onSearch: (q?: string) => void;
  onNearMe: () => void;
  recents: RecentDestination[];
  nearMeBusy?: boolean;
}) {
  return (
    <div
      className="psg-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background grid + roads + P-pins (decorative) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.5,
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice">
          <defs>
            <pattern id="psgHomeGrid" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M34 0 H0 V34" fill="none" stroke="var(--line)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="psgHomeFade" cx="50%" cy="0%" r="80%">
              <stop offset="0%" stopColor="var(--bg-0)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#psgHomeGrid)" />
          <path d="M-20 220 Q 120 200 200 240 T 420 220" stroke="var(--bg-2)" strokeWidth="22" fill="none" />
          <path d="M-20 460 Q 150 440 230 480 T 420 470" stroke="var(--bg-2)" strokeWidth="14" fill="none" />
          <path d="M80 -20 Q 100 200 90 400 T 90 880" stroke="var(--bg-2)" strokeWidth="12" fill="none" />
          <path d="M310 -20 Q 320 200 300 400 T 300 880" stroke="var(--bg-2)" strokeWidth="14" fill="none" />
          {[
            [55, 320],
            [180, 180],
            [240, 360],
            [330, 280],
            [120, 510],
            [280, 600],
            [55, 700],
          ].map(([cx, cy], i) => (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <circle r="7" fill="var(--bg-1)" stroke="var(--line-strong)" strokeWidth="1" />
              <text
                textAnchor="middle"
                y="3"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600 }}
                fill="var(--text-3)"
              >
                P
              </text>
            </g>
          ))}
          <rect width="100%" height="100%" fill="url(#psgHomeFade)" />
        </svg>
      </div>

      {/* Top bar */}
      <div style={{ padding: '52px 16px 12px', flexShrink: 0, position: 'relative' }}>
        <Wordmark size={19} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px', position: 'relative' }}>
        {/* Hero copy */}
        <div style={{ paddingTop: 28, paddingBottom: 18 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.8,
              lineHeight: 1.08,
              textWrap: 'balance',
            }}
          >
            Find parking before
            <br />
            you leave the house.
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 14,
              color: 'var(--text-2)',
              lineHeight: 1.4,
              maxWidth: 320,
            }}
          >
            HDB, URA and LTA carparks ranked by cost for your stay.
          </p>
        </div>

        {/* Search */}
        <SearchField
          value={destination}
          onChange={setDestination}
          onSubmit={onSearch}
          placeholder="Search destination, mall or postcode"
        />

        {/* Near-me */}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button
            onClick={onNearMe}
            disabled={nearMeBusy}
            style={{
              appearance: 'none',
              flex: 1,
              padding: '12px 14px',
              background: 'var(--bg-2)',
              border: '0.5px solid var(--line-strong)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--text-1)',
              fontSize: 14,
              fontWeight: 500,
              cursor: nearMeBusy ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              minHeight: 44,
              opacity: nearMeBusy ? 0.6 : 1,
            }}
          >
            <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
              <IconLocation size={16} stroke={2} />
            </span>
            {nearMeBusy ? 'Finding your location…' : 'Use my location'}
          </button>
        </div>

        {/* Planned stay */}
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 10,
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--text-3)',
                letterSpacing: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Planned stay
            </div>
          </div>
          <DurationStrip value={duration} onChange={setDuration} compact />
        </div>

        {/* Recent */}
        <div style={{ marginTop: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 10,
            }}
          >
            <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
              <IconHistory size={13} stroke={2} />
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--text-3)',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Recent
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              background: 'var(--bg-1)',
              border: '0.5px solid var(--line)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {recents.map((r, i) => (
              <button
                key={r.name}
                onClick={() => {
                  setDestination(r.name);
                  onSearch(r.name);
                }}
                style={{
                  appearance: 'none',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: 'transparent',
                  border: 0,
                  borderTop: i > 0 ? '0.5px solid var(--line)' : 'none',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
                  <IconPin size={15} stroke={2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                    {r.hint}
                  </div>
                </div>
                <IconChevronRight
                  size={14}
                  stroke={2}
                  style={{ color: 'var(--text-3)' }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
