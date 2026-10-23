import { useMemo, useState, useCallback } from 'react';
import type { Carpark, MergedSaveItem, RecentDestination, User } from '../lib/types';
import {
  pickCheapestId,
  selectResultsView,
  type SortBy,
  type VehicleFilter,
} from '../lib/resultsView';
import { estCostForStay, fmtDuration, type Stay } from '../lib/stay';
import { MonoLabel, Spinner } from '../components/atoms';
import { CarparkCard } from '../components/CarparkCard';
import { StayPlanner } from '../components/StayPlanner';
import { RealResultsMap } from '../components/RealResultsMap';
import { DetailScreen } from '../screens/DetailScreen';
import { PlaceAutocomplete } from '../components/PlaceAutocomplete';
import { ResultFilters } from '../components/ResultFilters';
import { vehicleEmptyCopy } from '../lib/lotTypes';
import { useWalkRoute } from '../hooks/useWalkRoute';
import { useCarparkNavigation } from '../hooks/useCarparkNavigation';
import { RadiusSelect } from '../components/RadiusSelect';
import { pickHeroCopy } from '../lib/heroCopy';
import { AppFooter } from '../components/AppFooter';
import { HomeRecentSection, HomeSavedSection } from '../components/HomeSections';
import { IconLocation, IconShare } from '../components/icons';

export type DesktopSavedProps = {
  merged: MergedSaveItem[];
  destinationCount: number;
  carparkCount: number;
  onSearchDestination: (item: MergedSaveItem & { kind: 'destination' }) => void;
  onOpenCarpark: (item: MergedSaveItem & { kind: 'carpark' }) => void;
  onRemoveDestination: (id: string) => void;
  onUnsaveCarpark: (id: string) => void;
  onAddDestination: () => void;
};

export type FindParkingDesktopProps = {
  destinationInput: string;
  setDestinationInput: (v: string) => void;
  headerDestination: string;
  onSearch: (q?: string) => void;
  onPickPlace: (place: { label: string; address: string; lat: number; lng: number }) => void;
  onNearMe: () => void;
  nearMeBusy: boolean;
  carparks: Carpark[];
  state: 'loading' | 'loaded' | 'degraded' | 'empty';
  destinationCoords: [number, number] | null;
  refreshedSecondsAgo: number | null;
  stay: Stay;
  setStay: (s: Stay) => void;
  availableOnly: boolean;
  setAvailableOnly: (v: boolean) => void;
  /** Motorcycle / heavy-vehicle lot filter (shared + persisted by App). */
  vehicles: VehicleFilter[];
  setVehicles: (v: VehicleFilter[]) => void;
  detailCp: Carpark | null;
  /** True while a deep-linked carpark (/carpark/:slug) is still loading. */
  detailLoading?: boolean;
  onOpenDetail: (cp: Carpark) => void;
  onCloseDetail: () => void;
  isCarparkSaved: (id: string) => boolean;
  onToggleSaveCarpark: (cp: Carpark) => void;
  /** Signed-in user + sign-in prompt — powers crowdsourced check-ins in Detail. */
  user: User | null;
  onRequireSignIn: () => void;
  /** Share the current "Carparks near X" results. */
  onShareResults: () => void;
  /** Current search radius in metres, and a setter that re-runs the search. */
  radiusM: number;
  onRadius: (m: number) => void;
  /** This browser's recent destinations, newest first (empty until a search). */
  recents: RecentDestination[];
};

/**
 * Desktop/tablet "Find parking" — a two-pane view: a results rail on the left
 * (search · stay · filter · cards, or a carpark detail panel) and the live map
 * on the right. Reuses the same data + components as the phone flow.
 */
export function FindParkingDesktop(
  props: FindParkingDesktopProps & { saved: DesktopSavedProps; onOpenSaved: () => void; onOpenAccount: () => void },
) {
  const {
    destinationInput, setDestinationInput, headerDestination, onSearch, onPickPlace,
    onNearMe, nearMeBusy, carparks, state, destinationCoords, refreshedSecondsAgo,
    stay, setStay, availableOnly, setAvailableOnly, vehicles, setVehicles,
    detailCp, detailLoading, onOpenDetail, onCloseDetail, isCarparkSaved, onToggleSaveCarpark, saved,
    user, onRequireSignIn, onShareResults, recents, radiusM, onRadius, onOpenSaved, onOpenAccount,
  } = props;

  const [sortBy, setSortBy] = useState<SortBy>('cost');
  const [evOnly, setEvOnly] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Navigate straight from a card; the app picker shows on first use.
  const nav = useCarparkNavigation('modal');
  // The emphasised carpark on the map: the open detail, else the hovered card.
  const activeId = detailCp?.id ?? hoverId;

  // Arbitrary-duration cost for the planned stay, priced per carpark.
  const costOf = useCallback((cp: Carpark) => estCostForStay(cp, stay), [stay]);
  const durationText = `EST · ${fmtDuration(stay.hours)}`;

  // Real walking route for the open carpark — drawn on the big map (not a
  // straight line). Only fetches when a carpark is open in detail.
  const walk = useWalkRoute(
    detailCp ? destinationCoords : null,
    detailCp ? detailCp.coords.entrance : [0, 0],
    detailCp?.walkMeters ?? 0,
    detailCp?.walkMin ?? 0,
  );
  const walkGeometry = detailCp && walk.source === 'onemap' && walk.geometry.length >= 2 ? walk.geometry : null;

  const { ranked, vehicleFilterEmpty, evFilterEmpty, pinnedId } = useMemo(
    () =>
      selectResultsView({
        carparks, state, availableOnly, evOnly, vehicles, sortBy, costOf, destinationLabel: headerDestination,
      }),
    [carparks, state, availableOnly, evOnly, vehicles, sortBy, costOf, headerDestination],
  );
  const vehicleEmpty = vehicleEmptyCopy(vehicles);
  const cheapestId = useMemo(() => pickCheapestId(ranked, 1, costOf), [ranked, costOf]);

  // Before any destination is chosen, show a focused landing (search + saved
  // places, no map) — mirroring the phone home rather than an empty map pane.
  // Exception: when a carpark is open directly (e.g. a `/carpark/:slug` deep
  // link or a saved-carpark open) there's no surrounding search, so
  // destinationCoords is null — but we must still show that carpark's Detail
  // (or its loading spinner), not the landing.
  const showLanding =
    !detailCp && !detailLoading && !destinationCoords && state !== 'loading';
  if (showLanding) {
    return (
      <LandingDesktop
        destinationInput={destinationInput}
        setDestinationInput={setDestinationInput}
        onSearch={onSearch}
        onPickPlace={onPickPlace}
        onNearMe={onNearMe}
        nearMeBusy={nearMeBusy}
        saved={saved}
        recents={recents}
        user={user}
        onOpenSaved={onOpenSaved}
        onOpenAccount={onOpenAccount}
      />
    );
  }

  // When the rail shows a carpark Detail (or its loading spinner) it must be a
  // flex column so DetailScreen's own `flex:1` gets a bounded height — its
  // internal body scrolls and the sticky "Navigate" CTA (position:absolute;
  // bottom:0) anchors to the rail's bottom. A plain block rail leaves the root
  // unbounded, pushing the CTA past the clipped viewport (it vanishes). The
  // search/cards branch keeps the simple scrolling block.
  const showingDetail = !!detailCp || !!detailLoading;

  return (
    <main style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      {/* Left rail */}
      <div
        style={{
          // Floor of 380px: below that the carpark cards start truncating
          // names and squeezing the price block. 42vw alone gave a tablet in
          // portrait (768px) a 322px rail, which was too tight to read.
          width: 'clamp(380px, 42vw, 440px)',
          maxWidth: 460,
          flexShrink: 0,
          height: '100%',
          minHeight: 0,
          position: 'relative',
          display: showingDetail ? 'flex' : 'block',
          flexDirection: showingDetail ? 'column' : undefined,
          overflowY: showingDetail ? 'hidden' : 'auto',
          borderRight: '0.5px solid var(--line-strong)',
          background: 'var(--bg-0)',
        }}
      >
        {detailCp ? (
          <DetailScreen
            cp={detailCp}
            destination={headerDestination}
            destinationCoords={destinationCoords}
            stay={stay}
            setStay={setStay}
            hideWalkMap
            navVariant="modal"
            onBack={onCloseDetail}
            refreshedSecondsAgo={refreshedSecondsAgo}
            degraded={state === 'degraded'}
            saved={isCarparkSaved(detailCp.id)}
            onToggleSave={() => onToggleSaveCarpark(detailCp)}
            user={user}
            onRequireSignIn={onRequireSignIn}
          />
        ) : detailLoading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13 }}>
            <Spinner /> Loading carpark…
          </div>
        ) : (
          <div className="psg-screen" style={{ padding: '22px 22px 32px' }}>
            {/* Search */}
            <PlaceAutocomplete
              value={destinationInput}
              onChange={setDestinationInput}
              onSubmitText={(v) => onSearch(v)}
              onPickPlace={onPickPlace}
              placeholder="Search destination, mall or postcode"
            />
            <button
              type="button"
              data-track="search_near_me"
              onClick={onNearMe}
              disabled={nearMeBusy}
              style={{
                appearance: 'none', width: '100%', marginTop: 10, padding: '11px 14px',
                background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: 'var(--text-1)', fontSize: 14, fontWeight: 500,
                cursor: nearMeBusy ? 'default' : 'pointer', minHeight: 44,
              }}
            >
              {nearMeBusy ? <Spinner /> : (
                <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                  <IconLocation size={16} stroke={2} />
                </span>
              )}
              {nearMeBusy ? 'Locating…' : 'Use my location'}
            </button>

            {/* Stay planner — drives every cost estimate. Starts collapsed to a
                one-line summary so the results lead. */}
            <div style={{ marginTop: 16 }}>
              <StayPlanner stay={stay} onChange={setStay} collapsible />
            </div>

            {/* Results header + filter/sort */}
            <div style={{ margin: '22px 0 12px' }}>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <MonoLabel>
                    {state === 'empty' ? 0 : ranked.length} carpark{ranked.length === 1 ? '' : 's'}
                    {headerDestination ? ` near ${headerDestination}` : ''}
                  </MonoLabel>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
                    within <RadiusSelect value={radiusM} onChange={onRadius} />
                  </div>
                </div>
                {destinationCoords && (
                  <button
                    type="button"
                    data-track="results_share"
                    onClick={onShareResults}
                    aria-label={`Share carparks near ${headerDestination}`}
                    style={{
                      appearance: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      padding: '6px 11px', borderRadius: 999, border: '0.5px solid var(--line-strong)',
                      background: 'var(--bg-1)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <IconShare size={14} stroke={2} />
                    Share
                  </button>
                )}
              </div>
              <ResultFilters
                sortBy={sortBy}
                onSortBy={setSortBy}
                availableOnly={availableOnly}
                onAvailableOnly={setAvailableOnly}
                evOnly={evOnly}
                onEvOnly={setEvOnly}
                vehicles={vehicles}
                onVehicles={setVehicles}
              />
            </div>

            {/* Cards */}
            {state === 'loading' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'var(--text-3)', fontSize: 13 }}>
                <Spinner /> Fetching live availability…
              </div>
            ) : ranked.length === 0 ? (
              <div style={{ marginTop: 8, padding: '28px 20px', textAlign: 'center', background: 'var(--bg-1)', border: '0.5px solid var(--line)', borderRadius: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
                  {vehicleFilterEmpty
                    ? vehicleEmpty.title
                    : evFilterEmpty ? 'No carparks with EV charging' : availableOnly ? 'No carparks with free lots' : 'No carparks nearby'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                  {vehicleFilterEmpty
                    ? vehicleEmpty.hint
                    : evFilterEmpty
                    ? 'Turn off the EV filter to see all carparks nearby.'
                    : availableOnly
                      ? 'Turn off “Available only” to see full carparks too.'
                      : 'Try a different destination or search wider.'}
                </div>
              </div>
            ) : (
              <div className="psg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    isActive={cp.id === hoverId}
                    onHoverChange={setHoverId}
                    degraded={state === 'degraded'}
                    onClick={() => onOpenDetail(cp)}
                    onNavigate={() => nav.navigate(cp)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map pane */}
      <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative', background: 'var(--bg-1)' }}>
        {(state === 'loaded' || state === 'degraded') && ranked.length > 0 ? (
          <div style={{ position: 'absolute', inset: 0 }}>
            <RealResultsMap
              variant="fill"
              carparks={ranked}
              cheapestId={cheapestId}
              activeId={activeId}
              walkGeometry={walkGeometry}
              duration={1}
              costOf={costOf}
              onSelect={onOpenDetail}
              degraded={state === 'degraded'}
              destinationCoords={destinationCoords}
            />
          </div>
        ) : detailCp ? (
          // Carpark opened directly (deep link / saved open) with no surrounding
          // search — centre the map on that single carpark.
          <div style={{ position: 'absolute', inset: 0 }}>
            <RealResultsMap
              variant="fill"
              carparks={[detailCp]}
              cheapestId={null}
              activeId={detailCp.id}
              walkGeometry={null}
              duration={1}
              costOf={costOf}
              onSelect={onOpenDetail}
              degraded={state === 'degraded'}
              destinationCoords={destinationCoords}
            />
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            {state === 'loading' || detailLoading ? 'Loading map…' : 'Search a destination to see carparks on the map'}
          </div>
        )}
      </div>
      {nav.picker}
    </main>
  );
}

/** Pre-search landing — focused single column (no map): search, saved, recents — same sections as the phone home. */
function LandingDesktop({
  destinationInput,
  setDestinationInput,
  onSearch,
  onPickPlace,
  onNearMe,
  nearMeBusy,
  saved,
  recents,
  user,
  onOpenSaved,
  onOpenAccount,
}: {
  destinationInput: string;
  setDestinationInput: (v: string) => void;
  onSearch: (q?: string) => void;
  onPickPlace: (place: { label: string; address: string; lat: number; lng: number }) => void;
  onNearMe: () => void;
  nearMeBusy: boolean;
  saved: DesktopSavedProps;
  recents: RecentDestination[];
  user: User | null;
  onOpenSaved: () => void;
  onOpenAccount: () => void;
}) {
  // Same hero copy as the phone home, locked per mount.
  const hero = useMemo(() => pickHeroCopy(), []);
  return (
    <main className="psg-screen" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, padding: '64px 24px 80px' }}>
        <h1 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1, textWrap: 'balance' }}>
          {hero.header}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.45, maxWidth: 420 }}>
          {hero.sub}
        </p>

        <PlaceAutocomplete
          value={destinationInput}
          onChange={setDestinationInput}
          onSubmitText={(v) => onSearch(v)}
          onPickPlace={onPickPlace}
          placeholder="Search destination, mall or postcode"
        />
        <button
          type="button"
          data-track="search_near_me"
          onClick={onNearMe}
          disabled={nearMeBusy}
          style={{
            appearance: 'none', width: '100%', marginTop: 10, padding: '11px 14px',
            background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--text-1)', fontSize: 14, fontWeight: 500,
            cursor: nearMeBusy ? 'default' : 'pointer', minHeight: 44,
          }}
        >
          {nearMeBusy ? <Spinner /> : <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><IconLocation size={16} stroke={2} /></span>}
          {nearMeBusy ? 'Locating…' : 'Use my location'}
        </button>

        <HomeSavedSection
          merged={saved.merged}
          onOpenSaved={onOpenSaved}
          onSearchSavedDestination={saved.onSearchDestination}
          onOpenSavedCarpark={saved.onOpenCarpark}
        />

        <HomeRecentSection
          recents={recents}
          user={user}
          setDestination={setDestinationInput}
          onSearch={onSearch}
          onPickPlace={onPickPlace}
          onOpenAccount={onOpenAccount}
        />

        <div style={{ marginTop: 28 }}>
          <AppFooter user={user} variant="modal" />
        </div>
      </div>
    </main>
  );
}
