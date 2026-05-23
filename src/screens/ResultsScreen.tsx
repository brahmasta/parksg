import { useMemo } from 'react';
import type { Carpark, DurationHours, ResultsState, ViewMode } from '../lib/types';
import { availabilityStatus, formatCost } from '../lib/availability';
import { AvailabilityDot, DurationStrip, Spinner } from '../components/atoms';
import { CarparkCard } from '../components/CarparkCard';
import { DegradedBanner } from '../components/DegradedBanner';
import {
  IconChevronLeft,
  IconList,
  IconMap,
  IconRefresh,
} from '../components/icons';

export function ResultsScreen({
  destination,
  duration,
  setDuration,
  carparks,
  state,
  availableOnly,
  setAvailableOnly,
  viewMode,
  onToggleView,
  onBack,
  onSelect,
  onRetry,
  onExpandRadius,
}: {
  destination: string;
  duration: DurationHours;
  setDuration: (v: DurationHours) => void;
  carparks: Carpark[];
  state: ResultsState;
  availableOnly: boolean;
  setAvailableOnly: (v: boolean) => void;
  viewMode: ViewMode;
  onToggleView: () => void;
  onBack: () => void;
  onSelect: (cp: Carpark) => void;
  onRetry: () => void;
  onExpandRadius: () => void;
}) {
  const ranked = useMemo(() => {
    const arr = [...carparks].sort(
      (a, b) => a.estByHours[duration] - b.estByHours[duration],
    );
    return availableOnly ? arr.filter((c) => c.lotsAvailable > 0) : arr;
  }, [carparks, duration, availableOnly]);

  return (
    <div
      className="psg-screen"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Top bar */}
      <div style={{ padding: '52px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
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
              flexShrink: 0,
            }}
          >
            <IconChevronLeft size={18} stroke={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--text-3)',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Carparks near
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-1)',
                letterSpacing: -0.2,
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {destination}
            </div>
          </div>
          <button
            onClick={onToggleView}
            aria-label="Toggle map view"
            style={{
              appearance: 'none',
              width: 36,
              height: 36,
              borderRadius: 999,
              background:
                viewMode === 'map' ? 'var(--accent-tint-strong)' : 'var(--bg-1)',
              border:
                viewMode === 'map'
                  ? '1px solid var(--accent)'
                  : '0.5px solid var(--line-strong)',
              color: viewMode === 'map' ? 'var(--accent-on)' : 'var(--text-2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {viewMode === 'map' ? <IconList size={16} stroke={2} /> : <IconMap size={16} stroke={2} />}
          </button>
        </div>

        {/* Duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <DurationStrip value={duration} onChange={setDuration} compact />
          </div>
        </div>

        {/* Result summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
            {state === 'empty' ? '0' : ranked.length} carpark
            {ranked.length === 1 ? '' : 's'}
            <span style={{ color: 'var(--text-3)' }}> · within 600m · </span>
            sorted by cost
          </div>
          <button
            onClick={() => setAvailableOnly(!availableOnly)}
            style={{
              appearance: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              border: availableOnly
                ? '1px solid var(--accent)'
                : '0.5px solid var(--line-strong)',
              background: availableOnly ? 'var(--accent-tint-strong)' : 'transparent',
              color: availableOnly ? 'var(--accent-on)' : 'var(--text-2)',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: availableOnly ? 'var(--accent)' : 'var(--ok)',
              }}
            />
            Available only
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0 30px' }}>
        {state === 'degraded' && <DegradedBanner onRetry={onRetry} />}

        {state === 'loading' && <ResultsLoading />}

        {state === 'empty' && (
          <EmptyResults destination={destination} onExpandRadius={onExpandRadius} onBack={onBack} />
        )}

        {(state === 'loaded' || state === 'degraded') &&
          (viewMode === 'map' ? (
            <ResultsMapView
              carparks={ranked}
              duration={duration}
              onSelect={onSelect}
              degraded={state === 'degraded'}
              destination={destination}
            />
          ) : (
            <div
              className="psg-stagger"
              style={{
                padding: '8px 16px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {ranked.map((cp, i) => (
                <CarparkCard
                  key={cp.id}
                  cp={cp}
                  duration={duration}
                  rank={i + 1}
                  isCheapest={i === 0}
                  degraded={state === 'degraded'}
                  onClick={() => onSelect(cp)}
                />
              ))}
              <div
                style={{
                  marginTop: 6,
                  padding: '0 4px',
                  fontSize: 11,
                  color: 'var(--text-3)',
                  lineHeight: 1.5,
                }}
              >
                Lot counts refresh every 60s · Private mall carparks not shown
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ResultsLoading() {
  return (
    <div
      style={{
        padding: '8px 16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 110,
            borderRadius: 14,
            background: 'var(--bg-1)',
            border: '0.5px solid var(--line)',
            opacity: 0.6 - i * 0.08,
          }}
        />
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 20,
          color: 'var(--text-3)',
          fontSize: 12.5,
        }}
      >
        <Spinner />
        Fetching live availability…
      </div>
    </div>
  );
}

function EmptyResults({
  destination,
  onExpandRadius,
  onBack,
}: {
  destination: string;
  onExpandRadius: () => void;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ width: 96, height: 96, marginBottom: 20, position: 'relative' }}>
        <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden>
          <circle cx="48" cy="48" r="44" fill="none" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2 4" />
          <circle cx="48" cy="48" r="30" fill="none" stroke="var(--line-strong)" strokeWidth="0.5" strokeDasharray="2 4" />
          <circle cx="48" cy="48" r="16" fill="none" stroke="var(--text-3)" strokeWidth="0.5" />
          <g transform="translate(48 48)">
            <circle r="6" fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="1.5" />
            <text
              textAnchor="middle"
              y="3"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600 }}
              fill="var(--accent)"
            >
              P
            </text>
          </g>
        </svg>
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: -0.3,
        }}
      >
        No carparks nearby
      </h2>
      <p
        style={{
          margin: '8px 0 24px',
          fontSize: 13.5,
          color: 'var(--text-2)',
          lineHeight: 1.5,
          maxWidth: 280,
        }}
      >
        No HDB or URA carparks found within 600m of{' '}
        <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>{destination}</strong>.
        This area may be served by private carparks.
      </p>
      <button
        onClick={onExpandRadius}
        style={{
          appearance: 'none',
          border: 0,
          padding: '12px 18px',
          background: 'var(--accent)',
          color: 'var(--accent-on)',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
        }}
      >
        <IconRefresh size={14} stroke={2.5} />
        Search wider (1 km)
      </button>
      <button
        onClick={onBack}
        style={{
          appearance: 'none',
          border: 0,
          marginTop: 12,
          padding: '10px 14px',
          background: 'transparent',
          color: 'var(--text-2)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Change destination
      </button>
    </div>
  );
}

const PIN_POSITIONS: { x: number; y: number }[] = [
  { x: 70, y: 280 },
  { x: 50, y: 380 },
  { x: 200, y: 240 },
  { x: 260, y: 160 },
  { x: 110, y: 460 },
];

function ResultsMapView({
  carparks,
  duration,
  onSelect,
  degraded,
  destination,
}: {
  carparks: Carpark[];
  duration: DurationHours;
  onSelect: (cp: Carpark) => void;
  degraded: boolean;
  destination: string;
}) {
  return (
    <div style={{ padding: '0 16px' }}>
      <div
        style={{
          position: 'relative',
          height: 380,
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--bg-1)',
          border: '0.5px solid var(--line)',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 358 380"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, display: 'block' }}
          aria-hidden
        >
          <defs>
            <pattern id="psgMapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0 H0 V20" fill="none" stroke="var(--line)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#psgMapGrid)" />
          <path
            d="M-20 200 Q 100 180 200 220 T 420 200"
            stroke="var(--bg-2)"
            strokeWidth="20"
            fill="none"
          />
          <path d="M120 -20 Q 140 200 120 400" stroke="var(--bg-2)" strokeWidth="14" fill="none" />
          <path d="M260 -20 Q 280 200 260 400" stroke="var(--bg-2)" strokeWidth="14" fill="none" />
          <g transform="translate(170 200)">
            <circle r="20" fill="var(--text-1)" opacity="0.06" />
            <circle r="10" fill="var(--text-1)" opacity="0.1" />
            <circle r="4" fill="var(--text-1)" />
          </g>
        </svg>
        {carparks.map((cp, i) => {
          const pos = PIN_POSITIONS[Math.min(i, PIN_POSITIONS.length - 1)];
          const status = availabilityStatus(degraded ? null : cp.lotsAvailable);
          const isCheapest = i === 0;
          return (
            <button
              key={cp.id}
              onClick={() => onSelect(cp)}
              aria-label={`${cp.name}, ${formatCost(cp.estByHours[duration])}`}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -100%)',
                appearance: 'none',
                border: 0,
                padding: 0,
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: isCheapest ? 'var(--accent)' : 'var(--bg-0)',
                  color: isCheapest ? 'var(--accent-on)' : 'var(--text-1)',
                  border:
                    '0.5px solid ' + (isCheapest ? 'var(--accent)' : 'var(--line-strong)'),
                  borderRadius: 999,
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                  whiteSpace: 'nowrap',
                }}
              >
                <AvailabilityDot status={status} size={6} />
                {formatCost(cp.estByHours[duration])}
              </div>
              <div
                style={{
                  width: 2,
                  height: 14,
                  background: isCheapest ? 'var(--accent)' : 'var(--text-1)',
                  opacity: 0.6,
                }}
              />
            </button>
          );
        })}
        <div
          style={{
            position: 'absolute',
            left: 170,
            top: 220,
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-2)',
            textAlign: 'center',
            padding: '2px 6px',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {destination}
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          padding: '0 4px',
          fontSize: 11,
          color: 'var(--text-3)',
          textAlign: 'center',
        }}
      >
        Tap a pin to view the carpark
      </div>
    </div>
  );
}
