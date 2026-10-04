import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RADIUS_M, widerRadius } from '../lib/radius';
import type { Carpark, ResultsState } from '../lib/types';
import {
  fetchCarparkById,
  fetchCarparkBySlug,
  fetchNearbyCarparks,
  type DbCarparkRaw,
} from '../lib/api/dbCarparks';
import { getHdbAvailability } from '../lib/api/hdb';
import { getLtaCarparks } from '../lib/api/lta';
import { getJustParkLots } from '../lib/api/justpark';
import { geocode, type GeocodedPlace } from '../lib/api/oneMap';
import { nearbyParking, type NearbyGooglePlace } from '../lib/api/googlePlaces';
import { filterNewGooglePlaces, googlePlaceToCarpark } from '../lib/googleCarpark';
import { GOOGLE_GAP_THRESHOLD } from '../lib/config';
import { evSnapshotAgeMinutes, fetchEvAvailability } from '../lib/api/ltaEv';
import { attachEvData } from '../lib/ev';
import { applyUraRates, currentDayType } from '../lib/uraJoin';
import { buildLiveLotsIndex, buildUraRatesIndex, dbRowToCarpark } from '../lib/carparkMapping';

const REFRESH_MS = 60_000;
const AVAIL_TIMEOUT_MS = 5_000;

// Supplementary Google carparks (gap-fill). Fetched on a fresh search only when
// our own DB returns fewer than GOOGLE_GAP_THRESHOLD carparks nearby (tunable
// via the VITE_GOOGLE_GAP_THRESHOLD env var — see src/lib/config.ts), then
// merged (deduped within ~60m of our own carparks). Held in memory only (never
// persisted — Google ToS) and reused on the 60s live-lot refresh rather than
// refetched, so each distinct search centre costs at most one Nearby call.
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
export type Trigger =
  | { kind: 'query'; query: string }
  | { kind: 'coords'; label: string; lat: number; lng: number; address?: string };

const LOADING: SearchResult = {
  state: 'loading',
  destination: null,
  carparks: [],
  refreshedSecondsAgo: null,
};

/**
 * @param initialTrigger When set (e.g. an SEO `/parking-near/:area` cold load),
 * the search fires on mount and `result.state` starts as `loading` from the
 * very first render — so the app boots straight into the results screen with no
 * home-screen flash before an effect redirects.
 */
export function useCarparks(initialTrigger: Trigger | null = null) {
  const [trigger, setTrigger] = useState<Trigger | null>(initialTrigger);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [result, setResult] = useState<SearchResult>(
    initialTrigger ? LOADING : EMPTY,
  );

  const refreshTimer = useRef<number | null>(null);
  const lastFetchedAt = useRef<number | null>(null);
  const requestSeq = useRef(0);
  const ticker = useRef<number | null>(null);
  // In-memory only (Google ToS forbids persisting place content/coords). Keyed
  // by rounded centre + radius; reused on the 60s refresh and on back-nav.
  const googleCache = useRef<Map<string, GoogleCacheEntry>>(new Map());

  // Resolve supplementary Google carparks for a search. Gap-fill: a fresh
  // search only fetches when our own coverage is sparse (dbCount below
  // GOOGLE_GAP_THRESHOLD); the 60s availability refresh reuses the cached set,
  // never refetching — so each distinct search centre costs at most one Nearby
  // call. Returns [] (degrades silently) on any failure.
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

        // A background availability refresh must never wipe an already-loaded
        // list. A transient DB-fetch failure here (dbCarparks === null) would
        // otherwise blank the very results the user navigates back to from
        // Detail — the reported "back shows 0 carparks, must Search wider"
        // bug. Keep the current list and re-arm the loop so it self-heals.
        if (!dbCarparks && isAvailOnly) {
          scheduleRefresh(t, radius);
          return;
        }
        // An empty DB result is NOT a dead end — we still query Google below.
        // Sparse areas (e.g. Jewel/Changi Airport) carry no HDB/URA/LTA carpark
        // but do have Google parking, so proceed with whatever the DB returned
        // and decide empty/degraded from the FINAL merged list.
        const dbList = dbCarparks ?? [];

        // Index live lots by DB carpark id so we can merge in O(1).
        const lotsByDbId = buildLiveLotsIndex(hdbAvail, ltaAvail, jpAvail);

        const now = new Date();
        const dayType = currentDayType(now);
        const hourOfDay = now.getHours();

        let carparks: Carpark[] = dbList
          .map((row) => dbRowToCarpark(row, dest, lotsByDbId, dayType, hourOfDay))
          .sort((a, b) => a.walkMeters - b.walkMeters);

        // URA carparks: swap the flat fallback for the real tiered schedule
        // now living in rate_rows (source='URA'). If the daily cron hasn't
        // populated any URA rows yet the index is empty and applyUraRates is
        // a no-op — the $1.20/30min fallback from dbRowToCarpark stands.
        carparks = applyUraRates(carparks, buildUraRatesIndex(dbList)).carparks;

        // EV spatial join — unchanged from the pre-DB flow.
        if (evSettled) {
          const ageMin =
            evSnapshotAgeMinutes(evSettled.lastUpdatedTime) ?? Number.POSITIVE_INFINITY;
          carparks = attachEvData(carparks, evSettled.locations, ageMin);
        }

        // Supplementary Google carparks (in-memory only). Append any that aren't
        // already covered by a DB carpark within ~60m, then re-sort by distance
        // so they interleave with our own results.
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

        // Nothing from the DB and nothing net-new from Google → empty (or
        // degraded if the DB fetch itself failed). On a background refresh,
        // never wipe an already-loaded list.
        if (carparks.length === 0) {
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
  // "Search wider": the next radius option up (600m → 1km → 1.5km → 2km).
  const expandRadius = useCallback(() => {
    const next = widerRadius(radiusM);
    if (trigger && next) void run(trigger, { radius: next });
  }, [trigger, run, radiusM]);
  // Search radius chosen in the results header. It sticks for later searches
  // (run() keeps the last radius), and re-runs the current one straight away.
  const setRadius = useCallback(
    (m: number) => {
      if (trigger) void run(trigger, { radius: m });
      else setRadiusM(m);
    },
    [trigger, run],
  );

  // Hydrate a fetched DB row into a Detail-ready Carpark. Static data (rates)
  // comes from the DB row; live lots + EV are merged best-effort so a slow
  // upstream just leaves those fields blank rather than blocking the open.
  // Shared by the id and slug loaders below.
  const hydrateCarpark = useCallback(
    async (row: DbCarparkRaw): Promise<Carpark> => {
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

  // Load a single carpark by id — used to open a saved carpark straight to its
  // Detail screen, without a surrounding destination search.
  const loadCarparkById = useCallback(
    async (id: string): Promise<Carpark | null> => {
      // Google supplementary carparks are ephemeral (in-memory, never persisted)
      // and have no DB row — a `google:` id can't be re-fetched, so a deep link
      // or saved-open of one resolves to null rather than hitting the DB.
      if (id.toLowerCase().startsWith('google:')) return null;
      const row = await fetchCarparkById(id).catch(() => null);
      if (!row) return null;
      return hydrateCarpark(row);
    },
    [hydrateCarpark],
  );

  // Load a single carpark by its URL slug — used when the app cold-loads on a
  // `/carpark/:slug` SEO URL and boots straight to that carpark's Detail screen.
  const loadCarparkBySlug = useCallback(
    async (slug: string): Promise<Carpark | null> => {
      const row = await fetchCarparkBySlug(slug).catch(() => null);
      if (!row) return null;
      return hydrateCarpark(row);
    },
    [hydrateCarpark],
  );

  return {
    result,
    search,
    searchAtCoords,
    retry,
    expandRadius,
    radiusM,
    setRadius,
    loadCarparkById,
    loadCarparkBySlug,
    trigger,
  };
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
