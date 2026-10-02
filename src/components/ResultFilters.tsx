import type { SortBy, VehicleFilter } from '../lib/resultsView';
import { LOT_TYPE_LABEL, vehicleEmptyCopy, vehiclePhrase } from '../lib/lotTypes';
import { FilterPill } from './FilterPill';
import { IconBolt, IconInfo } from './icons';

const VEHICLE_FILTERS: { type: VehicleFilter; track: string }[] = [
  { type: 'M', track: 'filter_motorcycle' },
  { type: 'H', track: 'filter_heavy_vehicle' },
];

const SORTS: [SortBy, string][] = [
  ['cost', 'Cheapest'],
  ['distance', 'Nearest'],
];

/**
 * Results sort + filter pills on one row, all the same weight: Cheapest /
 * Nearest (a pair, one always on), Available only, EV, and the vehicle
 * lot-type filters (motorcycle, heavy vehicle). Shared by the phone Results
 * header and the desktop rail.
 *
 * `scroll` keeps the row on one line and lets it scroll sideways (phone);
 * otherwise it wraps (desktop rail).
 *
 * With a vehicle filter on, a caveat line explains the two things a rider
 * would otherwise get wrong: only HDB carparks report lot types (so malls and
 * URA carparks drop out), and the prices / free-lot counts are still car
 * figures.
 */
export function ResultFilters({
  sortBy,
  onSortBy,
  availableOnly,
  onAvailableOnly,
  evOnly,
  onEvOnly,
  vehicles,
  onVehicles,
  scroll = false,
}: {
  sortBy: SortBy;
  onSortBy: (v: SortBy) => void;
  availableOnly: boolean;
  onAvailableOnly: (v: boolean) => void;
  evOnly: boolean;
  onEvOnly: (v: boolean) => void;
  vehicles: VehicleFilter[];
  onVehicles: (v: VehicleFilter[]) => void;
  scroll?: boolean;
}) {
  const toggle = (t: VehicleFilter) =>
    onVehicles(vehicles.includes(t) ? vehicles.filter((v) => v !== t) : [...vehicles, t]);

  return (
    <div>
      <div
        role="group"
        aria-label="Sort and filter carparks"
        className={scroll ? 'psg-no-scrollbar' : undefined}
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          ...(scroll
            ? { overflowX: 'auto', marginLeft: -16, marginRight: -16, padding: '0 16px' }
            : { flexWrap: 'wrap' }),
        }}
      >
        {SORTS.map(([key, label]) => (
          <span key={key} data-track="sort_carparks" style={{ display: 'inline-flex' }}>
            <FilterPill active={sortBy === key} onClick={() => onSortBy(key)} label={label} />
          </span>
        ))}
        <span data-track="filter_available_only" style={{ display: 'inline-flex' }}>
          <FilterPill
            active={availableOnly}
            onClick={() => onAvailableOnly(!availableOnly)}
            dot
            label="Available only"
          />
        </span>
        <span data-track="filter_ev" style={{ display: 'inline-flex' }}>
          <FilterPill
            active={evOnly}
            onClick={() => onEvOnly(!evOnly)}
            icon={<IconBolt size={11} stroke={2.25} />}
            label="EV"
          />
        </span>
        {VEHICLE_FILTERS.map(({ type, track }) => (
          <span key={type} data-track={track} style={{ display: 'inline-flex' }}>
            <FilterPill
              active={vehicles.includes(type)}
              onClick={() => toggle(type)}
              label={LOT_TYPE_LABEL[type]}
            />
          </span>
        ))}
      </div>
      {vehicles.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
            marginTop: 8,
            fontSize: 11.5,
            lineHeight: 1.45,
            color: 'var(--text-3)',
          }}
        >
          <span style={{ display: 'inline-flex', marginTop: 1, flexShrink: 0 }}>
            <IconInfo size={12} stroke={2} />
          </span>
          <span>
            Only HDB carparks report {vehiclePhrase(vehicles)} lots, so other carparks are
            hidden. Prices and free-lot counts are for cars.
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Empty state when a vehicle filter is on and no nearby carpark reports those
 * lots. Mirrors EVEmptyResults: there ARE carparks here, so the CTA drops the
 * filter rather than widening the search.
 */
export function VehicleEmptyResults({
  vehicles,
  onClearFilter,
}: {
  vehicles: VehicleFilter[];
  onClearFilter: () => void;
}) {
  const { title, hint } = vehicleEmptyCopy(vehicles);
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
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: -0.3,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '8px 0 20px',
          fontSize: 13,
          color: 'var(--text-2)',
          lineHeight: 1.5,
          maxWidth: 290,
        }}
      >
        {hint}
      </p>
      <button
        type="button"
        onClick={onClearFilter}
        style={{
          appearance: 'none',
          border: '0.5px solid var(--line-strong)',
          padding: '11px 16px',
          background: 'var(--bg-1)',
          color: 'var(--text-1)',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        Show all carparks
      </button>
    </div>
  );
}
