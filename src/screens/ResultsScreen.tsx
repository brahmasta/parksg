import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Carpark, DurationHours, ResultsState, ViewMode } from '../lib/types';
import { pickCheapestId, selectResultsView, type SortBy } from '../lib/resultsView';
import { DurationStrip, Spinner } from '../components/atoms';
import { CarparkCard } from '../components/CarparkCard';
import { FilterBar } from '../components/FilterBar';
import { DegradedBanner } from '../components/DegradedBanner';
import { AvailableEmptyResults } from '../components/AvailableEmptyResults';
import { EVEmptyResults } from '../components/EVEmptyResults';
import { FilterPill } from '../components/FilterPill';
import { RealResultsMap } from '../components/RealResultsMap';
import { PoweredByGoogle } from '../components/PoweredByGoogle';
import {
  IconBolt,
  IconChevronLeft,
  IconList,
  IconMap,
  IconRefresh,
  IconStar,
} from '../components/icons';

export function ResultsScreen({
  destination,
  destinationCoords,
  duration,
  setDuration,
  carparks,
  state,
  availableOnly,
  setAvailableOnly,
  evOnly,
  setEvOnly,
  viewMode,
  onToggleView,
  onBack,
  onSelect,
  onRetry,
  onExpandRadius,
  isCarparkSaved,
  onToggleSaveCarpark,
  destinationSaved,
  onSaveDestination,
  initialScrollTop = 0,
  onScrollChange,
}: {
  destination: string;
  destinationCoords: [number, number] | null;
  duration: DurationHours;
  setDuration: (v: DurationHours) => void;
  carparks: Carpark[];
  state: ResultsState;
  availableOnly: boolean;
  setAvailableOnly: (v: boolean) => void;
  evOnly: boolean;
  setEvOnly: (v: boolean) => void;
  viewMode: ViewMode;
  onToggleView: () => void;
  onBack: () => void;
  onSelect: (cp: Carpark) => void;
  onRetry: () => void;
  onExpandRadius: () => void;
  isCarparkSaved: (id: string) => boolean;
  onToggleSaveCarpark: (cp: Carpark) => void;
  destinationSaved: boolean;
  onSaveDestination: () => void;
  /** Scroll offset to restore on mount (preserved across Detail→back). */
  initialScrollTop?: number;
  /** Report the live scroll offset so the parent can preserve it. */
  onScrollChange?: (y: number) => void;
}) {
  // Ranking (nearest-first) + which filter, if any, emptied the list. Pure so
  // it's unit-tested in resultsView.test.ts; see selectResultsView for why the
  // EV vs Available empty-states must be attributed rather than guessed from a
  // bare length===0.
  // Cost/distance sort lives locally — only this screen needs it on mobile.
  const [sortBy, setSortBy] = useState<SortBy>('cost');

  const { ranked, evFilterEmpty, availFilterEmpty } = useMemo(
    () => selectResultsView({ carparks, state, availableOnly, evOnly, sortBy, duration }),
    [carparks, state, availableOnly, evOnly, sortBy, duration],
  );

  // Preserve the list's scroll position across Detail→back. The screen
  // unmounts when Detail opens, so we restore on mount and report changes up.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && initialScrollTop > 0) el.scrollTop = initialScrollTop;
    // Restore once on mount; not on every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CHEAPEST is awarded among trustworthy (non-stale) carparks so a 2018 figure
  // can't beat a live price unchallenged — see pickCheapestId (TRUST-1).
  const cheapestId = useMemo(() => pickCheapestId(ranked, duration), [ranked, duration]);
  const hasGoogle = useMemo(() => ranked.some((c) => c.source === 'GOOGLE'), [ranked]);

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
            type="button"
            onClick={onSaveDestination}
            disabled={destinationSaved}
            aria-pressed={destinationSaved}
            aria-label={
              destinationSaved
                ? 'Destination already saved'
                : 'Save destination'
            }
            style={{
              appearance: 'none',
              cursor: destinationSaved ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 11px 7px 9px',
              borderRadius: 999,
              background: destinationSaved
                ? 'var(--accent-tint)'
                : 'var(--bg-1)',
              border: destinationSaved
                ? '1px solid var(--accent)'
                : '0.5px solid var(--line-strong)',
              color: destinationSaved ? 'var(--accent)' : 'var(--text-2)',
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: -0.05,
              fontFamily: 'var(--font-body)',
              flexShrink: 0,
              transition: 'all 140ms ease',
              minHeight: 32,
            }}
          >
            <IconStar size={13} stroke={2} />
            {destinationSaved ? 'Saved' : 'Save'}
          </button>
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
            sorted by {sortBy === 'cost' ? 'cost' : 'distance'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <FilterPill
              active={evOnly}
              onClick={() => setEvOnly(!evOnly)}
              icon={<IconBolt size={11} stroke={2.25} />}
              label="EV"
            />
          </div>
        </div>

        {/* Sort (Cheapest/Nearest) + Available-only */}
        <div style={{ marginTop: 12 }}>
          <FilterBar
            sortBy={sortBy}
            onSortBy={setSortBy}
            availableOnly={availableOnly}
            onAvailableOnly={setAvailableOnly}
          />
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        onScroll={(e) => onScrollChange?.((e.target as HTMLDivElement).scrollTop)}
        style={{ flex: 1, overflow: 'auto', padding: '4px 0 30px' }}
      >
        {state === 'degraded' && <DegradedBanner onRetry={onRetry} />}

        {state === 'loading' && <ResultsLoading />}

        {state === 'empty' && (
          <EmptyResults destination={destination} onExpandRadius={onExpandRadius} onBack={onBack} />
        )}

        {evFilterEmpty && (
          <EVEmptyResults
            destination={destination}
            onClearFilter={() => setEvOnly(false)}
          />
        )}

        {availFilterEmpty && (
          <AvailableEmptyResults
            destination={destination}
            onClearFilter={() => setAvailableOnly(false)}
            onExpandRadius={onExpandRadius}
          />
        )}

        {(state === 'loaded' || state === 'degraded') && !evFilterEmpty && !availFilterEmpty &&
          (viewMode === 'map' ? (
            <RealResultsMap
              carparks={ranked}
              cheapestId={cheapestId}
              duration={duration}
              onSelect={onSelect}
              degraded={state === 'degraded'}
              destinationCoords={destinationCoords}
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
                  isCheapest={cp.id === cheapestId}
                  degraded={state === 'degraded'}
                  onClick={() => onSelect(cp)}
                  saved={isCarparkSaved(cp.id)}
                  onToggleSave={() => onToggleSaveCarpark(cp)}
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
                Lot counts refresh every 60s · Some mall carparks show rates only, no live count
                {hasGoogle && ' · Some results powered by Google — rates & availability unverified'}
              </div>
              {hasGoogle && <PoweredByGoogle />}
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

