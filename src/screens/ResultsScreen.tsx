import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Carpark, ResultsState, ViewMode, User } from '../lib/types';
import {
  pickCheapestId,
  selectResultsView,
  type SortBy,
  type VehicleFilter,
} from '../lib/resultsView';
import { estCostForStay, fmtDuration, type Stay } from '../lib/stay';
import { Spinner } from '../components/atoms';
import { CarparkCard } from '../components/CarparkCard';
import { StayPlanner } from '../components/StayPlanner';
import { DegradedBanner } from '../components/DegradedBanner';
import { AvailableEmptyResults } from '../components/AvailableEmptyResults';
import { EVEmptyResults } from '../components/EVEmptyResults';
import { AddCarparkLink } from '../components/AddCarparkLink';
import { ResultFilters, VehicleEmptyResults } from '../components/ResultFilters';
import { RealResultsMap } from '../components/RealResultsMap';
import { RadiusSelect } from '../components/RadiusSelect';
import { fmtRadius, widerRadius } from '../lib/radius';
import { useCarparkNavigation } from '../hooks/useCarparkNavigation';
import { PoweredByGoogle } from '../components/PoweredByGoogle';
import {
  IconChevronLeft,
  IconList,
  IconMap,
  IconRefresh,
  IconShare,
  IconBookmark,
} from '../components/icons';

export function ResultsScreen({
  destination,
  destinationCoords,
  stay,
  setStay,
  carparks,
  state,
  availableOnly,
  setAvailableOnly,
  evOnly,
  setEvOnly,
  vehicles,
  setVehicles,
  viewMode,
  onViewMode,
  onBack,
  onSelect,
  onRetry,
  onExpandRadius,
  radiusM,
  onRadius,
  destinationSaved,
  onSaveDestination,
  onShare,
  initialScrollTop = 0,
  onScrollChange,
  user = null,
}: {
  destination: string;
  destinationCoords: [number, number] | null;
  stay: Stay;
  setStay: (s: Stay) => void;
  carparks: Carpark[];
  state: ResultsState;
  availableOnly: boolean;
  setAvailableOnly: (v: boolean) => void;
  evOnly: boolean;
  setEvOnly: (v: boolean) => void;
  vehicles: VehicleFilter[];
  setVehicles: (v: VehicleFilter[]) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  onBack: () => void;
  onSelect: (cp: Carpark) => void;
  onRetry: () => void;
  onExpandRadius: () => void;
  /** Current search radius in metres, and a setter that re-runs the search. */
  radiusM: number;
  onRadius: (m: number) => void;
  destinationSaved: boolean;
  onSaveDestination: () => void;
  /** Share this "Carparks near X" page (native sheet, else copy link). */
  onShare: () => void;
  /** Scroll offset to restore on mount (preserved across Detail→back). */
  initialScrollTop?: number;
  /** Report the live scroll offset so the parent can preserve it. */
  onScrollChange?: (y: number) => void;
  /** Signed-in user (pre-fills the "Add a carpark" contact); null = anonymous. */
  user?: User | null;
}) {
  // Ranking (nearest-first) + which filter, if any, emptied the list. Pure so
  // it's unit-tested in resultsView.test.ts; see selectResultsView for why the
  // EV vs Available empty-states must be attributed rather than guessed from a
  // bare length===0.
  // Cost/distance sort lives locally — only this screen needs it on mobile.
  const [sortBy, setSortBy] = useState<SortBy>('cost');

  // Arbitrary-duration cost for the planned stay (parity with desktop).
  const costOf = useCallback((cp: Carpark) => estCostForStay(cp, stay), [stay]);
  const durationText = `EST · ${fmtDuration(stay.hours)}`;

  const { ranked, vehicleFilterEmpty, evFilterEmpty, availFilterEmpty, pinnedId } = useMemo(
    () =>
      selectResultsView({
        carparks, state, availableOnly, evOnly, vehicles, sortBy, costOf, destinationLabel: destination,
      }),
    [carparks, state, availableOnly, evOnly, vehicles, sortBy, costOf, destination],
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
  const cheapestId = useMemo(() => pickCheapestId(ranked, 1, costOf), [ranked, costOf]);
  const hasGoogle = useMemo(() => ranked.some((c) => c.source === 'GOOGLE'), [ranked]);
  // Navigate straight from a card; the app picker shows on first use.
  const nav = useCarparkNavigation('sheet');

  return (
    <div
      className="psg-screen"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Top bar */}
      <div style={{ padding: 'var(--screen-top) 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            data-track="nav_back"
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
            data-track="add_destination"
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
              width: 36,
              height: 36,
              borderRadius: 999,
              background: destinationSaved ? 'var(--accent-tint)' : 'var(--bg-1)',
              border: destinationSaved
                ? '1px solid var(--accent)'
                : '0.5px solid var(--line-strong)',
              color: destinationSaved ? 'var(--accent)' : 'var(--text-2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 140ms ease',
            }}
          >
            <IconBookmark filled={destinationSaved} size={16} stroke={2} />
          </button>
          <button
            type="button"
            onClick={onShare}
            data-track="results_share"
            aria-label={`Share carparks near ${destination}`}
            style={{
              appearance: 'none',
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'var(--bg-1)',
              border: '0.5px solid var(--line-strong)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconShare size={16} stroke={2} />
          </button>
        </div>

        {/* List | Map — the top-level choice, above every filter. */}
        <ViewTabs viewMode={viewMode} onViewMode={onViewMode} />

        {/* Sort + filters, one row of equal pills */}
        <div style={{ marginTop: 12 }}>
          <ResultFilters
            sortBy={sortBy}
            onSortBy={setSortBy}
            availableOnly={availableOnly}
            onAvailableOnly={setAvailableOnly}
            evOnly={evOnly}
            onEvOnly={setEvOnly}
            vehicles={vehicles}
            onVehicles={setVehicles}
            scroll
          />
        </div>

        {/* Result summary */}
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-2)' }}>
          {state === 'empty' ? '0' : ranked.length} carpark
          {ranked.length === 1 ? '' : 's'}
          <span style={{ color: 'var(--text-3)' }}> · within </span>
          <RadiusSelect value={radiusM} onChange={onRadius} />
          <span style={{ color: 'var(--text-3)' }}> · </span>
          sorted by {sortBy === 'cost' ? 'cost' : 'distance'}
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        onScroll={(e) => onScrollChange?.((e.target as HTMLDivElement).scrollTop)}
        style={{ flex: 1, overflow: 'auto', padding: '4px 0 30px' }}
      >
        {state === 'degraded' && <DegradedBanner onRetry={onRetry} />}

        {/* Stay planner — same control + arbitrary-duration cost as desktop.
            Lives at the top of the scrollable body, collapsed to a one-line
            summary until opened so the results come first. */}
        {(state === 'loaded' || state === 'degraded') && (
          <div style={{ padding: '4px 16px 10px' }}>
            <StayPlanner stay={stay} onChange={setStay} collapsible />
          </div>
        )}

        {state === 'loading' && <ResultsLoading />}

        {state === 'empty' && (
          <EmptyResults
            destination={destination}
            radiusM={radiusM}
            onExpandRadius={onExpandRadius}
            onBack={onBack}
            user={user}
          />
        )}

        {vehicleFilterEmpty && (
          <VehicleEmptyResults vehicles={vehicles} onClearFilter={() => setVehicles([])} />
        )}

        {evFilterEmpty && (
          <EVEmptyResults
            destination={destination}
            onClearFilter={() => setEvOnly(false)}
            radiusLabel={fmtRadius(radiusM)}
          />
        )}

        {availFilterEmpty && (
          <AvailableEmptyResults
            destination={destination}
            onClearFilter={() => setAvailableOnly(false)}
            onExpandRadius={onExpandRadius}
            radiusLabel={fmtRadius(radiusM)}
            canExpand={widerRadius(radiusM) != null}
          />
        )}

        {(state === 'loaded' || state === 'degraded') &&
          !vehicleFilterEmpty && !evFilterEmpty && !availFilterEmpty &&
          (viewMode === 'map' ? (
            <RealResultsMap
              carparks={ranked}
              cheapestId={cheapestId}
              duration={1}
              costOf={costOf}
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
                  duration={1}
                  cost={costOf(cp)}
                  durationText={durationText}
                  rank={pinnedId ? i : i + 1}
                  atDestination={cp.id === pinnedId}
                  isCheapest={cp.id === cheapestId}
                  degraded={state === 'degraded'}
                  onClick={() => onSelect(cp)}
                  onNavigate={() => nav.navigate(cp)}
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
      {nav.picker}
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
  radiusM,
  onExpandRadius,
  onBack,
  user = null,
}: {
  destination: string;
  radiusM: number;
  onExpandRadius: () => void;
  onBack: () => void;
  user?: User | null;
}) {
  const wider = widerRadius(radiusM);
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
        No HDB or URA carparks found within {fmtRadius(radiusM)} of{' '}
        <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>{destination}</strong>.
        This area may be served by private carparks.
      </p>
      {wider != null && (
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
        Search wider ({fmtRadius(wider)})
      </button>
      )}
      <button
        onClick={onBack}
        data-track="nav_back"
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
      <div style={{ marginTop: 18, fontSize: 13, color: 'var(--text-3)' }}>
        Know a carpark here?{' '}
        <AddCarparkLink user={user} variant="modal" label="Add it →" />
      </div>
    </div>
  );
}

/** Full-width List | Map segmented switch for the phone results header. */
function ViewTabs({
  viewMode,
  onViewMode,
}: {
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
}) {
  const tabs: [ViewMode, string, typeof IconList][] = [
    ['list', 'List', IconList],
    ['map', 'Map', IconMap],
  ];
  return (
    <div
      role="tablist"
      aria-label="Results view"
      style={{
        marginTop: 14,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 4,
        padding: 4,
        background: 'var(--bg-2)',
        border: '0.5px solid var(--line)',
        borderRadius: 12,
      }}
    >
      {tabs.map(([mode, label, Icon]) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            data-track={`view_mode_${mode}`}
            onClick={() => onViewMode(mode)}
            style={{
              appearance: 'none',
              border: 0,
              borderRadius: 9,
              padding: '8px 0',
              minHeight: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              background: active ? 'var(--bg-1)' : 'transparent',
              color: active ? 'var(--text-1)' : 'var(--text-2)',
              fontSize: 13.5,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 120ms ease',
            }}
          >
            <Icon size={15} stroke={2} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
