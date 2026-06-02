import { useMemo, useState, useCallback } from 'react';
import type { Carpark } from '../lib/types';
import { pickCheapestId, selectResultsView, type SortBy } from '../lib/resultsView';
import { estCostForStay, fmtDuration, type Stay } from '../lib/stay';
import { MonoLabel, Spinner } from '../components/atoms';
import { CarparkCard } from '../components/CarparkCard';
import { FilterBar } from '../components/FilterBar';
import { StayPlanner } from '../components/StayPlanner';
import { RealResultsMap } from '../components/RealResultsMap';
import { DetailScreen } from '../screens/DetailScreen';
import { PlaceAutocomplete } from '../components/PlaceAutocomplete';
import { IconLocation } from '../components/icons';

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
  detailCp: Carpark | null;
  onOpenDetail: (cp: Carpark) => void;
  onCloseDetail: () => void;
  isCarparkSaved: (id: string) => boolean;
  onToggleSaveCarpark: (cp: Carpark) => void;
};

/**
 * Desktop/tablet "Find parking" — a two-pane view: a results rail on the left
 * (search · stay · filter · cards, or a carpark detail panel) and the live map
 * on the right. Reuses the same data + components as the phone flow.
 */
export function FindParkingDesktop(props: FindParkingDesktopProps) {
  const {
    destinationInput, setDestinationInput, headerDestination, onSearch, onPickPlace,
    onNearMe, nearMeBusy, carparks, state, destinationCoords, refreshedSecondsAgo,
    stay, setStay, availableOnly, setAvailableOnly,
    detailCp, onOpenDetail, onCloseDetail, isCarparkSaved, onToggleSaveCarpark,
  } = props;

  const [sortBy, setSortBy] = useState<SortBy>('cost');
  const [hoverId, setHoverId] = useState<string | null>(null);
  // The emphasised carpark on the map: the open detail, else the hovered card.
  const activeId = detailCp?.id ?? hoverId;

  // Arbitrary-duration cost for the planned stay, priced per carpark.
  const costOf = useCallback((cp: Carpark) => estCostForStay(cp, stay), [stay]);
  const durationText = `EST · ${fmtDuration(stay.hours)}`;

  const { ranked } = useMemo(
    () => selectResultsView({ carparks, state, availableOnly, evOnly: false, sortBy, costOf }),
    [carparks, state, availableOnly, sortBy, costOf],
  );
  const cheapestId = useMemo(() => pickCheapestId(ranked, 1, costOf), [ranked, costOf]);

  return (
    <main style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      {/* Left rail */}
      <div
        style={{
          width: 'min(440px, 42vw)',
          maxWidth: 460,
          flexShrink: 0,
          height: '100%',
          position: 'relative',
          overflowY: detailCp ? 'hidden' : 'auto',
          borderRight: '0.5px solid var(--line-strong)',
          background: 'var(--bg-0)',
        }}
      >
        {detailCp ? (
          <DetailScreen
            cp={detailCp}
            destination={headerDestination}
            destinationCoords={destinationCoords}
            duration={1}
            setDuration={() => {}}
            cost={costOf(detailCp)}
            durationText={`${fmtDuration(stay.hours)} stay`}
            hideDurationStrip
            hideWalkMap
            navVariant="modal"
            onBack={onCloseDetail}
            refreshedSecondsAgo={refreshedSecondsAgo}
            degraded={state === 'degraded'}
            saved={isCarparkSaved(detailCp.id)}
            onToggleSave={() => onToggleSaveCarpark(detailCp)}
          />
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

            {/* Stay planner — drives every cost estimate */}
            <div style={{ marginTop: 16 }}>
              <StayPlanner stay={stay} onChange={setStay} />
            </div>

            {/* Results header + filter/sort */}
            <div style={{ margin: '22px 0 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                <MonoLabel>
                  {state === 'empty' ? 0 : ranked.length} carpark{ranked.length === 1 ? '' : 's'}
                  {headerDestination ? ` near ${headerDestination}` : ''}
                </MonoLabel>
              </div>
              <FilterBar
                sortBy={sortBy}
                onSortBy={setSortBy}
                availableOnly={availableOnly}
                onAvailableOnly={setAvailableOnly}
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
                  {availableOnly ? 'No carparks with free lots' : 'No carparks nearby'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                  {availableOnly ? 'Turn off “Available only” to see full carparks too.' : 'Try a different destination or search wider.'}
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
                    rank={i + 1}
                    isCheapest={cp.id === cheapestId}
                    isActive={cp.id === hoverId}
                    onHoverChange={setHoverId}
                    degraded={state === 'degraded'}
                    onClick={() => onOpenDetail(cp)}
                    saved={isCarparkSaved(cp.id)}
                    onToggleSave={() => onToggleSaveCarpark(cp)}
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
              duration={1}
              costOf={costOf}
              onSelect={onOpenDetail}
              degraded={state === 'degraded'}
              destinationCoords={destinationCoords}
            />
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            {state === 'loading' ? 'Loading map…' : 'Search a destination to see carparks on the map'}
          </div>
        )}
      </div>
    </main>
  );
}
