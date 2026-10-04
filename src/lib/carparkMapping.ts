/**
 * Supabase carpark rows → the app's Carpark model, plus the live-lots merge.
 * Pure (no browser APIs), so the phone app (hooks/useCarparks.ts) and server
 * endpoints (api/car/nearby.ts) price and merge carparks the same way.
 */
import type { Carpark, DurationHours, LotType, Operator, RateRow } from './types';
import type { DbCarparkRaw, DbRateRowRaw } from './api/dbCarparks';
import type { HdbAvailability } from './api/hdb';
import type { LtaCarpark } from './api/lta';
import type { JustParkLot } from './api/justpark';
import type { UraCarparkRates } from './ura';
import { haversineMeters, walkMinutesFromMeters } from './geo';
import { HDB_MOTORCYCLE_RATES, hdbHasMotorcycleLots } from './hdbMotorcycle';
import { estimateCostCentsAt } from './rateMath';
import { estByHoursFor, ratesFor } from './cost';

// ──────────────────────────────────────────────────────────────────────
// DB row → app Carpark
// ──────────────────────────────────────────────────────────────────────

/** Add 'M' when the carpark publishes motorcycle rates (URA), or — since the
 * HDB live feed never reports motorcycle lots — when an HDB carpark is on the
 * community motorcycle list. */
function withMotorcycle(row: DbCarparkRaw, types: LotType[], hasMotoRates: boolean): LotType[] {
  if (types.includes('M')) return types;
  const hasM =
    hasMotoRates ||
    (row.agency === 'HDB' && hdbHasMotorcycleLots(row.lat!, row.lng!, row.address));
  if (!hasM) return types;
  return (['C', 'M', 'H'] as LotType[]).filter((t) => t === 'M' || types.includes(t));
}

const DURATION_VALUES: DurationHours[] = [0.5, 1, 1.5, 2, 3, 4];

const LOT_TYPE_ORDER: LotType[] = ['C', 'M', 'H'];

/** carparks.lot_types in C→M→H order; undefined when unknown or empty. */
function storedLotTypes(row: DbCarparkRaw): LotType[] | undefined {
  if (!row.lot_types) return undefined;
  const types = LOT_TYPE_ORDER.filter((t) => row.lot_types!.includes(t));
  return types.length > 0 ? types : undefined;
}

/** Motorcycle / heavy-vehicle lot counts, when stored. */
function storedLotCounts(row: DbCarparkRaw): Carpark['lotCounts'] {
  const counts: NonNullable<Carpark['lotCounts']> = {};
  if (row.motorcycle_lots) counts.M = row.motorcycle_lots;
  if (row.heavy_lots) counts.H = row.heavy_lots;
  return Object.keys(counts).length > 0 ? counts : undefined;
}

export function dbRowToCarpark(
  row: DbCarparkRaw,
  dest: { lat: number; lng: number },
  lotsByDbId: Map<string, LiveLots>,
  dayType: 'WEEKDAY' | 'SAT' | 'SUN_PH',
  hourOfDay: number,
): Carpark {
  const meters = haversineMeters(dest, { lat: row.lat!, lng: row.lng! });

  // Group rate_rows into the three day-type buckets the runtime expects.
  const rates = bucketRateRows(row.rate_rows);
  const allRows = row.rate_rows.filter(isCarRow).map(dbToRateRow);
  const motoRows = row.rate_rows.filter((r) => r.veh_cat === 'MOTORCYCLE');
  const motorcycleRates = motoRows.length
    ? bucketRateRows(motoRows.map((r) => ({ ...r, veh_cat: 'CAR' as const })))
    : undefined;

  // Compute estByHours from the structured rate rows. If the DB carpark
  // has no usable rate (e.g. an LTA-CSV standalone with all-zero stub rows),
  // fall back to the operator default so the cost cell never reads $0.
  const op = (row.agency === 'HDB' || row.agency === 'URA' || row.agency === 'LTA'
    ? row.agency
    : 'LTA') as Operator;
  const estByHours = computeEstByHours(allRows, dayType, hourOfDay) ?? estByHoursFor(op);
  const fallbackRates =
    rates.weekday.length === 0 && rates.saturday.length === 0 && rates.sundayPH.length === 0
      ? ratesFor(op)
      : rates;

  const live = lotsByDbId.get(row.id);
  // Per-vehicle types from the live feed (HDB), else the stored ones (URA
  // capacity data), else car-only; withMotorcycle then adds 'M' from
  // motorcycle rates or the HDB community list.
  const lotTypes = withMotorcycle(
    row,
    live?.lotTypes ?? storedLotTypes(row) ?? (['C'] satisfies LotType[]),
    !!motorcycleRates,
  );

  return {
    id: row.id.toLowerCase(),
    name: row.name,
    block: row.address ?? row.source_code,
    operator: op,
    lotTypes,
    lotCounts: storedLotCounts(row),
    heightLimitM: row.height_limit_m != null ? Number(row.height_limit_m) : undefined,
    carParkType: row.car_park_type ?? undefined,
    lotsAvailable: live?.lotsAvailable ?? null,
    lotsTotal: live?.lotsTotal ?? row.total_lots ?? 0,
    walkMin: walkMinutesFromMeters(meters),
    walkMeters: Math.round(meters),
    grace: row.rate_rows[0]?.grace_minutes ?? (row.agency === 'HDB' ? 10 : 0),
    coords: { entrance: [row.lat!, row.lng!] },
    rates: fallbackRates,
    // HDB's flat motorcycle charge where the carpark has motorcycle lots but
    // no schedule of its own.
    motorcycleRates:
      motorcycleRates ??
      (row.agency === 'HDB' && lotTypes.includes('M') ? HDB_MOTORCYCLE_RATES : undefined),
    estByHours,
  };
}

/**
 * Reconstruct the per-ppCode UraCarparkRates shape that applyUraRates expects
 * from the URA-source rate_rows embedded on each DB carpark. Keyed by the
 * lowercased ppCode so it matches `cp.id.replace(/^ura:/, '')` inside the join.
 * Carparks with no URA rows are omitted, leaving them on the flat fallback.
 */
export function buildUraRatesIndex(rows: DbCarparkRaw[]): Map<string, UraCarparkRates> {
  const out = new Map<string, UraCarparkRates>();
  for (const row of rows) {
    if (row.agency !== 'URA') continue;
    const uraRows = row.rate_rows.filter((r) => r.source === 'URA');
    if (uraRows.length === 0) continue;

    const ppCode = row.id.toLowerCase().replace(/^ura:/, '');
    const entry: UraCarparkRates = {
      ppCode,
      ppName: row.name,
      parkCapacity: row.total_lots ?? 0,
      weekday: [],
      saturday: [],
      sundayPH: [],
      motorcycle: [],
    };
    for (const r of uraRows) {
      const rr = dbToRateRow(r);
      if (r.veh_cat === 'MOTORCYCLE') entry.motorcycle.push(rr);
      else if (!isCarRow(r)) continue;
      else if (r.day_type === 'WEEKDAY') entry.weekday.push(rr);
      else if (r.day_type === 'SAT') entry.saturday.push(rr);
      else entry.sundayPH.push(rr);
    }
    out.set(ppCode, entry);
  }
  return out;
}

function bucketRateRows(rows: DbRateRowRaw[]): Carpark['rates'] {
  const out: Carpark['rates'] = { weekday: [], saturday: [], sundayPH: [] };
  for (const r of rows) {
    // Motorcycle / heavy rows have their own schedule; never mix into car rates.
    if (!isCarRow(r)) continue;
    // Skip parser-stub rows the migration emits for unparseable CSV cells
    // (per_block_cents=0, block_minutes=0) — they'd add noise to the schedule.
    if (r.per_block_cents === 0 && r.block_minutes === 0 && r.per_entry_cents == null) {
      continue;
    }
    const target =
      r.day_type === 'WEEKDAY' ? out.weekday : r.day_type === 'SAT' ? out.saturday : out.sundayPH;
    target.push(dbToRateRow(r));
  }
  return out;
}

function isCarRow(r: DbRateRowRaw): boolean {
  return (r.veh_cat ?? 'CAR') === 'CAR';
}

function dbToRateRow(r: DbRateRowRaw): RateRow {
  return {
    dayType: r.day_type,
    startTime: r.start_time ? r.start_time.slice(0, 5) : undefined, // 'HH:mm:ss' → 'HH:mm'
    endTime: r.end_time ? r.end_time.slice(0, 5) : undefined,
    perBlockCents: r.per_block_cents,
    blockMinutes: r.block_minutes,
    firstHourCents: r.first_hour_cents ?? undefined,
    // "1st 2 hrs" weekend tiers at the CapitaLand malls; without it a $2.65 /
    // 2h first tier was priced as $2.65 / 1h. A 0-minute tier is meaningless.
    firstBlockMinutes: r.first_block_minutes || undefined,
    perEntryCents: r.per_entry_cents ?? undefined,
    capCents: r.cap_cents ?? undefined,
    graceMinutes: r.grace_minutes ?? undefined,
    system: r.system,
    vehCat: r.veh_cat,
    source: r.source,
    effectiveFrom: r.effective_from ?? undefined,
  };
}

function computeEstByHours(
  rows: RateRow[],
  dayType: 'WEEKDAY' | 'SAT' | 'SUN_PH',
  hourOfDay: number,
): Carpark['estByHours'] | null {
  if (rows.length === 0) return null;
  const out: Partial<Record<DurationHours, number>> = {};
  for (const d of DURATION_VALUES) {
    const cents = estimateCostCentsAt(rows, d, { dayType, hourOfDay });
    if (cents == null) return null;
    out[d] = +(cents / 100).toFixed(2);
  }
  return out as Carpark['estByHours'];
}

// ──────────────────────────────────────────────────────────────────────
// Live availability merge
// ──────────────────────────────────────────────────────────────────────

/** One carpark's live figures, merged from whichever feed is authoritative.
 * `lotTypes` is only known for HDB carparks (the live feed lists a row per
 * vehicle type); other agencies fall back to car-only in dbRowToCarpark. */
export type LiveLots = {
  lotsAvailable: number | null;
  lotsTotal?: number;
  lotTypes?: LotType[];
};

export function buildLiveLotsIndex(
  hdb: Map<string, HdbAvailability> | null | undefined,
  lta: LtaCarpark[] | null | undefined,
  justpark?: JustParkLot[] | null | undefined,
): Map<string, LiveLots> {
  const out = new Map<string, LiveLots>();
  // LTA first: DataMall also reports HDB-agency carparks but only carries an
  // available count, no capacity. The HDB feed below is authoritative for
  // HDB carparks (it has total_lots too), so it must overwrite these — write
  // LTA first so the HDB pass wins and never loses the total.
  if (lta) {
    for (const cp of lta) {
      // LTA's id is the bare source code; DB id is "AGENCY:id".
      out.set(`${cp.agency}:${cp.id}`, { lotsAvailable: cp.lotsAvailable });
    }
  }
  if (hdb) {
    for (const [carParkNo, a] of hdb.entries()) {
      out.set(`HDB:${carParkNo}`, {
        lotsAvailable: a.lots_available,
        lotsTotal: a.total_lots,
        lotTypes: a.lotTypes.length ? a.lotTypes : undefined,
      });
    }
  }
  // JustPark last and authoritative for CapitaLand malls: these are curated
  // LTA: carparks that previously showed "rates only, no live count". The proxy
  // already keys each entry by the full DB id (e.g. "LTA:65"), and the feed
  // carries both a live available count and a capacity, so it wins over any
  // stale DataMall figure for the same id.
  if (justpark) {
    for (const cp of justpark) {
      out.set(cp.id, {
        lotsAvailable: cp.lotsAvailable,
        lotsTotal: cp.lotsTotal ?? undefined,
      });
    }
  }
  return out;
}
