import { useCallback, useEffect, useRef, useState } from 'react';
import type { Carpark, ResultsState } from '../lib/types';
import {
  getHdbAvailability,
  getHdbCarparkInfo,
  type HdbAvailability,
  type HdbCarparkInfo,
} from '../lib/api/hdb';
import { geocode, type GeocodedPlace } from '../lib/api/oneMap';
import { haversineMeters, walkMinutesFromMeters } from '../lib/geo';
import { hdbEstByHours, hdbRates } from '../lib/cost';

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
  | { kind: 'coords'; label: string; lat: number; lng: number };

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
            ? { label: t.label, address: t.label, postal: '', lat: t.lat, lng: t.lng }
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

        const info = await getHdbCarparkInfo();
        if (requestSeq.current !== seq) return;

        // Nearby HDB carparks first — sorted by distance for the initial cut.
        const nearby = info
          .map((cp) => ({ cp, meters: haversineMeters(dest, cp) }))
          .filter((x) => x.meters <= radius)
          .sort((a, b) => a.meters - b.meters);

        if (nearby.length === 0) {
          setResult({
            state: 'empty',
            destination: dest,
            carparks: [],
            refreshedSecondsAgo: null,
          });
          return;
        }

        // Pull live lot counts. If it fails / times out we go "degraded".
        let avail: Map<string, HdbAvailability> | null = null;
        try {
          avail = await withTimeout(getHdbAvailability(), AVAIL_TIMEOUT_MS);
          lastFetchedAt.current = Date.now();
        } catch {
          avail = null;
        }

        if (requestSeq.current !== seq) return;

        const carparks = nearby.map(({ cp, meters }) =>
          toCarpark(cp, meters, avail?.get(cp.car_park_no) ?? null),
        );

        setResult({
          state: avail ? 'loaded' : 'degraded',
          destination: dest,
          carparks,
          refreshedSecondsAgo: avail
            ? 0
            : lastFetchedAt.current
              ? Math.floor((Date.now() - lastFetchedAt.current) / 1000)
              : null,
        });

        // Schedule periodic availability refresh.
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        if (avail) {
          refreshTimer.current = window.setTimeout(() => {
            void run(t, { radius, availabilityOnly: true });
          }, REFRESH_MS);
        }
      } catch (err) {
        if (requestSeq.current !== seq) return;
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
    (label: string, lat: number, lng: number) =>
      setTrigger({ kind: 'coords', label, lat, lng }),
    [],
  );
  const retry = useCallback(() => {
    if (trigger) void run(trigger);
  }, [trigger, run]);
  const expandRadius = useCallback(() => {
    if (trigger) void run(trigger, { radius: 1000 });
  }, [trigger, run]);

  return { result, search, searchAtCoords, retry, expandRadius, trigger };
}

function toCarpark(
  info: HdbCarparkInfo,
  meters: number,
  avail: HdbAvailability | null,
): Carpark {
  const name = displayName(info);
  return {
    id: info.car_park_no,
    name,
    block: info.address,
    operator: 'HDB',
    lotTypes: ['C'],
    lotsAvailable: avail?.lots_available ?? 0,
    lotsTotal: avail?.total_lots ?? 0,
    walkMin: walkMinutesFromMeters(meters),
    walkMeters: Math.round(meters),
    grace: 10,
    coords: { entrance: [info.lat, info.lng] },
    rates: hdbRates(),
    estByHours: hdbEstByHours(),
  };
}

/** Pull a short, human carpark name out of the HDB address.
 * Addresses look like "Blk 270/271 Albert Centre Basement Car Park" or
 * "Blk 175/183 To 185 Toa Payoh Town Centre" or "Blk 98a Aljunied Crescent". */
function displayName(info: HdbCarparkInfo): string {
  let a = info.address;
  // Strip the leading block reference, including range forms
  // like "Blk 175/183 To 185" or "Blk 175 To 185a".
  a = a.replace(/^Blk\s+\S+(\s+To\s+\S+)?\s*/i, '').trim();
  // Strip trailing "Car Park" / "Basement Car Park" / "Multi-Storey Car Park"
  a = a.replace(/\s+(Basement|Multi[- ]Storey)?\s*Car Park$/i, '').trim();
  return a || info.address;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}
