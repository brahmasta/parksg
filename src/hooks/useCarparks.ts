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
import { getJustParkLots, type JustParkLot } from '../lib/api/justpark';
import { geocode, type GeocodedPlace } from '../lib/api/oneMap';
import { nearbyParking, type NearbyGooglePlace } from '../lib/api/googlePlaces';
import { filterNewGooglePlaces, googlePlaceToCarpark } from '../lib/googleCarpark';
import { haversineMeters, walkMinutesFromMeters } from '../lib/geo';
import { estimateCostCentsAt } from '../lib/rateMath';
import { estByHoursFor, ratesFor } from '../lib/cost';
import { evSnapshotAgeMinutes, fetchEvAvailability } from '../lib/api/ltaEv';
import { attachEvData } from '../lib/ev';
import { applyUraRates, currentDayType } from '../lib/uraJoin';
import type { UraCarparkRates } from '../lib/ura';

const DEFAULT_RADIUS_M = 600;
const REFRESH_MS = 60_000;
const AVAIL_TIMEOUT_MS = 5_000;

// Supplementary Google carparks (gap-fill). Only fetched on a fresh search when
// our own DB returns fewer than this many carparks nearby — dense, well-covered
// areas stay DB-only (Google Nearby Search is billed per request). Results are
// held in memory only (never persisted — Google ToS) and reused on the 60s
// live-lot refresh rather than refetched.
const GOOGLE_GAP_THRESHOLD = 5;
const GOOGLE_FETCH_TIMEOUT_MS = 8_000;
const GOOGLE_CACHE_TTL_MS = 10 * 60_000;
const GOOGLE_CACHE_MAX = 20;

type GoogleCacheEntry = { places: NearbyGooglePlace[]; at: number };
const googleCacheKey = (
  dest: { lat: number; lng: number },
  radius: number,
): string => `${dest.lat.toFixed(3)},${dest.lng.toFixed(3)},${radius}`;

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
  // In-memory only (Google ToS forbids persisting place content/coords). Keyed
  // by rounded centre + radius; reused on the 60s refresh and on back-nav.
  const googleCache = useRef<Map<string, GoogleCacheEntry>>(new Map());

  // Resolve supplementary Google carparks for a search. Gap-fill: a fresh
  // search only fetches when our own coverage is sparse (dbCount below the
  // threshold); the 60s availability refresh reuses the cached set, never
  // refetching. Returns [] (degrades silently) on any failure.
  const resolveGoogleNearby = useCallback(
    async (
      dest: { lat: number; lng: number },
      radius: number,
      isAvailOnly: boolean,
      dbCount: number,
    ): Promise<NearbyGooglePlace[]> => {
      const key = googleCacheKey(dest, radius);
      const cached = googleCache.current.get(key);
      const fresh = cached && Date.now() - cached.at < GOOGLE_CACHE_TTL_MS;

      if (isAvailOnly) return fresh ? cached!.places : [];
      if (dbCount >= GOOGLE_GAP_THRESHOLD) return []; // well covered — skip (cost control)
      if (fresh) return cached!.places;

      const places = await withTimeout(
        nearbyParking(dest, radius),
        GOOGLE_FETCH_TIMEOUT_MS,
      ).catch(() => [] as NearbyGooglePlace[]);

      // Bound the cache: drop the oldest entry when full.
      if (googleCache.current.size >= GOOGLE_CACHE_MAX) {
        const oldest = googleCache.current.keys().next().value;
        if (oldest !== undefined) googleCache.current.delete(oldest);
      }
      googleCache.current.set(key, { places, at: Date.now() });
      return places;
    },
    [],
  );

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

      // Arm the next 60s live-lot refresh. Pulled out so the failure paths below
      // can keep the loop alive without first wiping the list (see isAvailOnly
      // guards): a background refresh must never blank an already-loaded result.
      const scheduleRefresh = (trig: Trigger, rad: number) => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(() => {
          void run(trig, { radius: rad, availabilityOnly: true });
        }, REFRESH_MS);
      };

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
          // Preserve the loaded list on a background refresh; only a fresh
          // search with no resolvable destination should show the empty state.
          if (isAvailOnly) {
            scheduleRefresh(t, radius);
            return;
          }
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
        const [dbCarparks, hdbAvail, ltaAvail, jpAvail, evSettled] = await Promise.all([
          fetchNearbyCarparks(dest, radius).catch(() => null),
          withTimeout(getHdbAvailability(), AVAIL_TIMEOUT_MS).catch(() => null),
          withTimeout(getLtaCarparks(), 8_000).catch(() => null),
          withTimeout(getJustParkLots(), 8_000).catch(() => null),
          withTimeout(fetchEvAvailability(), 10_000).catch(() => null),
        ]);
        if (requestSeq.current !== seq) return;

        if (hdbAvail || ltaAvail) lastFetchedAt.current = Date.now();

        if (!dbCarparks || dbCarparks.length === 0) {
          // A background availability refresh must never wipe an already-loaded
          // list. A transient DB-fetch failure here (dbCarparks === null) would
          // otherwise blank the very results the user navigates back to from
          // Detail — the reported "back shows 0 carparks, must Search wider"
          // bug. Keep the current list and re-arm the loop so it self-heals.
          if (isAvailOnly) {
            scheduleRefresh(t, radius);
            return;
          }
          setResult({
            state: dbCarparks ? 'empty' : 'degraded',
            destination: dest,
            carparks: [],
            refreshedSecondsAgo: null,
          });
          return;
        }

        // Index live lots by DB carpark id so we can merge in O(1).
        const lotsByDbId = buildLiveLotsIndex(hdbAvail, ltaAvail, jpAvail);

        const now = new Date();
        const dayType = currentDayType(now);
        const hourOfDay = now.getHours();

        let carparks: Carpark[] = dbCarparks
          .map((row) => dbRowToCarpark(row, dest, lotsByDbId, dayType, hourOfDay))
          .sort((a, b) => a.walkMeters - b.walkMeters);

        // URA carparks: swap the flat fallback for the real tiered schedule
        // now living in rate_rows (source='URA'). If the daily cron hasn't
        // populated any URA rows yet the index is empty and applyUraRates is
        // a no-op — the $1.20/30min fallback from dbRowToCarpark stands.
        carparks = applyUraRates(carparks, buildUraRatesIndex(dbCarparks)).carparks;

        // EV spatial join — unchanged from the pre-DB flow.
        if (evSettled) {
          const ageMin =
            evSnapshotAgeMinutes(evSettled.lastUpdatedTime) ?? Number.POSITIVE_INFINITY;
          carparks = attachEvData(carparks, evSettled.locations, ageMin);
        }

        // Supplementary Google carparks (gap-fill, in-memory only). Append any
        // that aren't already covered by a DB carpark within ~60m, then re-sort
        // by distance so they interleave with our own results.
        const googlePlaces = await resolveGoogleNearby(dest, radius, isAvailOnly, carparks.length);
        if (requestSeq.current !== seq) return;
        if (googlePlaces.length > 0) {
          const supplementary = filterNewGooglePlaces(
            googlePlaces.map((p) => googlePlaceToCarpark(p, dest)),
            carparks,
          );
          if (supplementary.length > 0) {
            carparks = [...carparks, ...supplementary].sort(
              (a, b) => a.walkMeters - b.walkMeters,
            );
          }
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
        if (hdbAvail || ltaAvail) scheduleRefresh(t, radius);
      } catch (err) {
        if (requestSeq.current !== seq) return;
        // eslint-disable-next-line no-console
        console.error('useCarparks failed', err);
        // Same rule as above: a thrown error during a background refresh must
        // not blank a good list — preserve it and keep retrying. Only a fresh
        // search failure surfaces the empty state.
        if (isAvailOnly) {
          scheduleRefresh(t, radius);
          return;
        }
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
    [radiusM, resolveGoogleNearby],
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
      // Google supplementary carparks are ephemeral (in-memory, never persisted)
      // and have no DB row — a `google:` id can't be re-fetched, so a deep link
      // or saved-open of one resolves to null rather than hitting the DB.
      if (id.toLowerCase().startsWith('google:')) return null;
      const row = await fetchCarparkById(id).catch(() => null);
      if (!row) return null;

      const wantHdb = row.agency === 'HDB';
      const [hdbAvail, ltaAvail, jpAvail, evSettled] = await Promise.all([
        wantHdb
          ? withTimeout(getHdbAvailability(), AVAIL_TIMEOUT_MS).catch(() => null)
          : Promise.resolve(null),
        !wantHdb
          ? withTimeout(getLtaCarparks(), AVAIL_TIMEOUT_MS).catch(() => null)
          : Promise.resolve(null),
        !wantHdb
          ? withTimeout(getJustParkLots(), AVAIL_TIMEOUT_MS).catch(() => null)
          : Promise.resolve(null),
        withTimeout(fetchEvAvailability(), AVAIL_TIMEOUT_MS).catch(() => null),
      ]);

      const lotsByDbId = buildLiveLotsIndex(hdbAvail, ltaAvail, jpAvail);
      const now = new Date();
      // No destination context here, so anchor distance math on the carpark
      // itself (walk ≈ 0). The Detail screen receives destinationCoords=null
      // and falls back to its non-routed walk card.
      const self = { lat: row.lat!, lng: row.lng! };
      let cp = dbRowToCarpark(row, self, lotsByDbId, currentDayType(now), now.getHours());
      cp = applyUraRates([cp], buildUraRatesIndex([row])).carparks[0] ?? cp;
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
  lotsByDbId: Map<string, LiveLots>,
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
    // Real per-vehicle types when the live feed carries them (HDB); otherwise
    // car-only, since other agencies don't break availability out by type.
    lotTypes: live?.lotTypes ?? (['C'] satisfies LotType[]),
    lotsAvailable: live?.lotsAvailable ?? null,
    lotsTotal: live?.lotsTotal ?? row.total_lots ?? 0,
    walkMin: walkMinutesFromMeters(meters),
    walkMeters: Math.round(meters),
    grace: row.rate_rows[0]?.grace_minutes ?? (row.agency === 'HDB' ? 10 : 0),
    coords: { entrance: [row.lat!, row.lng!] },
    rates: fallbackRates,
    estByHours,
  };
}

/**
 * Reconstruct the per-ppCode UraCarparkRates shape that applyUraRates expects
 * from the URA-source rate_rows embedded on each DB carpark. Keyed by the
 * lowercased ppCode so it matches `cp.id.replace(/^ura:/, '')` inside the join.
 * Carparks with no URA rows are omitted, leaving them on the flat fallback.
 */
function buildUraRatesIndex(rows: DbCarparkRaw[]): Map<string, UraCarparkRates> {
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
    };
    for (const r of uraRows) {
      const rr = dbToRateRow(r);
      if (r.day_type === 'WEEKDAY') entry.weekday.push(rr);
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

/** One carpark's live figures, merged from whichever feed is authoritative.
 * `lotTypes` is only known for HDB carparks (the live feed lists a row per
 * vehicle type); other agencies fall back to car-only in dbRowToCarpark. */
type LiveLots = {
  lotsAvailable: number | null;
  lotsTotal?: number;
  lotTypes?: LotType[];
};

function buildLiveLotsIndex(
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
