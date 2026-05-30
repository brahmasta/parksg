import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Carpark,
  DurationHours,
  LotType,
  Operator,
  RateRow,
  ResultsState,
} from '../lib/types';
import {
  fetchCarparkById,
  fetchNearbyCarparks,
  type DbCarparkRaw,
  type DbRateRowRaw,
} from '../lib/api/dbCarparks';
import { getHdbAvailability, type HdbAvailability } from '../lib/api/hdb';
import { getLtaCarparks, type LtaCarpark } from '../lib/api/lta';
import { geocode, type GeocodedPlace } from '../lib/api/oneMap';
import { haversineMeters, walkMinutesFromMeters } from '../lib/geo';
import { estimateCostCentsAt } from '../lib/rateMath';
import { estByHoursFor, ratesFor } from '../lib/cost';
import { evSnapshotAgeMinutes, fetchEvAvailability } from '../lib/api/ltaEv';
import { attachEvData } from '../lib/ev';
import { currentDayType } from '../lib/uraJoin';

const DEFAULT_RADIUS_M = 600;
const REFRESH_MS = 60_000;
const AVAIL_TIMEOUT_MS = 5_000;

export type SearchResult = {
  state: ResultsState;
  destination: GeocodedPlace | null;
  carparks: Carpark[];
  /** Seconds since the live lot counts last refreshed; null while loading. */
  refreshedSecondsAgo: number | null;
};

const EMPTY: SearchResult = {
  state: 'loaded',
  destination: null,
  carparks: [],
  refreshedSecondsAgo: null,
};

/** Drives the whole search pipeline. Callers pass a destination query
 * (e.g. "Vivocity"), the desired radius, and get back a ranked result. */
type Trigger =
  | { kind: 'query'; query: string }
  | { kind: 'coords'; label: string; lat: number; lng: number; address?: string };

export function useCarparks() {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [result, setResult] = useState<SearchResult>(EMPTY);

  const refreshTimer = useRef<number | null>(null);
  const lastFetchedAt = useRef<number | null>(null);
  const requestSeq = useRef(0);
  const ticker = useRef<number | null>(null);

  // Re-render once per second so "Lot count last refreshed Ns ago" stays fresh.
  useEffect(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = window.setInterval(() => {
      if (lastFetchedAt.current) {
        setResult((prev) => ({
          ...prev,
          refreshedSecondsAgo: Math.floor(
            (Date.now() - lastFetchedAt.current!) / 1000,
          ),
        }));
      }
    }, 1000);
    return () => {
      if (ticker.current) clearInterval(ticker.current);
    };
  }, []);

  const run = useCallback(
    async (t: Trigger, opts: { radius?: number; availabilityOnly?: boolean } = {}) => {
      const radius = opts.radius ?? radiusM;
      setRadiusM(radius);

      const seq = ++requestSeq.current;
      const isAvailOnly = opts.availabilityOnly === true;

      if (!isAvailOnly) {
        setResult({
          state: 'loading',
          destination: null,
          carparks: [],
          refreshedSecondsAgo: null,
        });
      }

      try {
        // For an availability-only refresh we keep the current destination
        // and just re-pull the lot counts.
        const dest: GeocodedPlace | null = isAvailOnly
          ? result.destination
          : t.kind === 'coords'
            ? {
                label: t.label,
                address: t.address ?? t.label,
                postal: extractSgPostal(t.address) ?? '',
                lat: t.lat,
                lng: t.lng,
              }
            : await geocode(t.query);
        if (!dest) {
          if (requestSeq.current !== seq) return;
          setResult({
            state: 'empty',
            destination: null,
            carparks: [],
            refreshedSecondsAgo: null,
          });
          return;
        }

        // Static (carparks + rate_rows) comes from the Supabase DB; live
        // (HDB lots / URA+LTA lots / EV connectors) still comes from the
        // upstream APIs because those values change every minute. Each is
        // independent — a failed availability call yields a degraded
        // result rather than blocking the whole search.
        const [dbCarparks, hdbAvail, ltaAvail, evSettled] = await Promise.all([
          fetchNearbyCarparks(dest, radius).catch(() => null),
          withTimeout(getHdbAvailability(), AVAIL_TIMEOUT_MS).catch(() => null),
          withTimeout(getLtaCarparks(), 8_000).catch(() => null),
          withTimeout(fetchEvAvailability(), 10_000).catch(() => null),
        ]);
        if (requestSeq.current !== seq) return;

        if (hdbAvail || ltaAvail) lastFetchedAt.current = Date.now();

        if (!dbCarparks || dbCarparks.length === 0) {
          setResult({
            state: dbCarparks ? 'empty' : 'degraded',
            destination: dest,
            carparks: [],
            refreshedSecondsAgo: null,
          });
          return;
        }

        // Index live lots by DB carpark id so we can merge in O(1).
        const lotsByDbId = buildLiveLotsIndex(hdbAvail, ltaAvail);

        const now = new Date();
        const dayType = currentDayType(now);
        const hourOfDay = now.getHours();

        let carparks: Carpark[] = dbCarparks
          .map((row) => dbRowToCarpark(row, dest, lotsByDbId, dayType, hourOfDay))
          .sort((a, b) => a.walkMeters - b.walkMeters);

        // EV spatial join — unchanged from the pre-DB flow.
        if (evSettled) {
          const ageMin =
            evSnapshotAgeMinutes(evSettled.lastUpdatedTime) ?? Number.POSITIVE_INFINITY;
          carparks = attachEvData(carparks, evSettled.locations, ageMin);
        }

        // Degraded if BOTH live-lot sources failed and we have carparks
        // that needed them. Either source returning is enough — the other
        // just leaves a subset of carparks showing em-dashes, which is the
        // existing behaviour.
        const degraded = !hdbAvail && !ltaAvail;

        setResult({
          state: degraded ? 'degraded' : 'loaded',
          destination: dest,
          carparks,
          refreshedSecondsAgo:
            hdbAvail || ltaAvail
              ? 0
              : lastFetchedAt.current
                ? Math.floor((Date.now() - lastFetchedAt.current) / 1000)
                : null,
        });

        // Schedule the next live-lot refresh.
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        if (hdbAvail || ltaAvail) {
          refreshTimer.current = window.setTimeout(() => {
            void run(t, { radius, availabilityOnly: true });
          }, REFRESH_MS);
        }
      } catch (err) {
        if (requestSeq.current !== seq) return;
        // eslint-disable-next-line no-console
        console.error('useCarparks failed', err);
        setResult({
          state: 'empty',
          destination: null,
          carparks: [],
          refreshedSecondsAgo: null,
        });
      }
    },
    // result.destination is intentionally not a dep — `run` is invoked imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [radiusM],
  );

  // Re-run whenever the caller fires a new trigger.
  useEffect(() => {
    if (trigger == null) return;
    void run(trigger);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const search = useCallback(
    (q: string) => setTrigger({ kind: 'query', query: q }),
    [],
  );
  const searchAtCoords = useCallback(
    (label: string, lat: number, lng: number, address?: string) =>
      setTrigger({ kind: 'coords', label, lat, lng, address }),
    [],
  );
  const retry = useCallback(() => {
    if (trigger) void run(trigger);
  }, [trigger, run]);
  const expandRadius = useCallback(() => {
    if (trigger) void run(trigger, { radius: 1000 });
  }, [trigger, run]);

  // Load a single carpark by id — used to open a saved carpark straight to
  // its Detail screen, without a surrounding destination search. Static data
  // (rates) comes from the DB row; live lots + EV are merged best-effort so a
  // slow upstream just leaves those fields blank rather than blocking the open.
  const loadCarparkById = useCallback(
    async (id: string): Promise<Carpark | null> => {
      const row = await fetchCarparkById(id).catch(() => null);
      if (!row) return null;

      const wantHdb = row.agency === 'HDB';
      const [hdbAvail, ltaAvail, evSettled] = await Promise.all([
        wantHdb
          ? withTimeout(getHdbAvailability(), AVAIL_TIMEOUT_MS).catch(() => null)
          : Promise.resolve(null),
        !wantHdb
          ? withTimeout(getLtaCarparks(), AVAIL_TIMEOUT_MS).catch(() => null)
          : Promise.resolve(null),
        withTimeout(fetchEvAvailability(), AVAIL_TIMEOUT_MS).catch(() => null),
      ]);

      const lotsByDbId = buildLiveLotsIndex(hdbAvail, ltaAvail);
      const now = new Date();
      // No destination context here, so anchor distance math on the carpark
      // itself (walk ≈ 0). The Detail screen receives destinationCoords=null
      // and falls back to its non-routed walk card.
      const self = { lat: row.lat!, lng: row.lng! };
      let cp = dbRowToCarpark(row, self, lotsByDbId, currentDayType(now), now.getHours());
      if (evSettled) {
        const ageMin =
          evSnapshotAgeMinutes(evSettled.lastUpdatedTime) ?? Number.POSITIVE_INFINITY;
        cp = attachEvData([cp], evSettled.locations, ageMin)[0] ?? cp;
      }
      return cp;
    },
    [],
  );

  return { result, search, searchAtCoords, retry, expandRadius, loadCarparkById, trigger };
}

// ──────────────────────────────────────────────────────────────────────
// DB row → app Carpark
// ──────────────────────────────────────────────────────────────────────

const DURATION_VALUES: DurationHours[] = [0.5, 1, 1.5, 2, 3, 4];

function dbRowToCarpark(
  row: DbCarparkRaw,
  dest: { lat: number; lng: number },
  lotsByDbId: Map<string, { lotsAvailable: number; lotsTotal?: number }>,
  dayType: 'WEEKDAY' | 'SAT' | 'SUN_PH',
  hourOfDay: number,
): Carpark {
  const meters = haversineMeters(dest, { lat: row.lat!, lng: row.lng! });

  // Group rate_rows into the three day-type buckets the runtime expects.
  const rates = bucketRateRows(row.rate_rows);
  const allRows = row.rate_rows.map(dbToRateRow);

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

  return {
    id: row.id.toLowerCase(),
    name: row.name,
    block: row.address ?? row.source_code,
    operator: op,
    lotTypes: ['C'] satisfies LotType[],
    lotsAvailable: live?.lotsAvailable ?? 0,
    lotsTotal: live?.lotsTotal ?? row.total_lots ?? 0,
    walkMin: walkMinutesFromMeters(meters),
    walkMeters: Math.round(meters),
    grace: row.rate_rows[0]?.grace_minutes ?? (row.agency === 'HDB' ? 10 : 0),
    coords: { entrance: [row.lat!, row.lng!] },
    rates: fallbackRates,
    estByHours,
  };
}

function bucketRateRows(rows: DbRateRowRaw[]): Carpark['rates'] {
  const out: Carpark['rates'] = { weekday: [], saturday: [], sundayPH: [] };
  for (const r of rows) {
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

function dbToRateRow(r: DbRateRowRaw): RateRow {
  return {
    dayType: r.day_type,
    startTime: r.start_time ? r.start_time.slice(0, 5) : undefined, // 'HH:mm:ss' → 'HH:mm'
    endTime: r.end_time ? r.end_time.slice(0, 5) : undefined,
    perBlockCents: r.per_block_cents,
    blockMinutes: r.block_minutes,
    firstHourCents: r.first_hour_cents ?? undefined,
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

function buildLiveLotsIndex(
  hdb: Map<string, HdbAvailability> | null | undefined,
  lta: LtaCarpark[] | null | undefined,
): Map<string, { lotsAvailable: number; lotsTotal?: number }> {
  const out = new Map<string, { lotsAvailable: number; lotsTotal?: number }>();
  if (hdb) {
    for (const [carParkNo, a] of hdb.entries()) {
      out.set(`HDB:${carParkNo}`, {
        lotsAvailable: a.lots_available,
        lotsTotal: a.total_lots,
      });
    }
  }
  if (lta) {
    for (const cp of lta) {
      // LTA's id is the bare source code; DB id is "AGENCY:id".
      out.set(`${cp.agency}:${cp.id}`, { lotsAvailable: cp.lotsAvailable });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Misc
// ──────────────────────────────────────────────────────────────────────

function extractSgPostal(address: string | undefined): string | null {
  if (!address) return null;
  const m = /\b(\d{6})\b/.exec(address);
  return m ? m[1] : null;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}
