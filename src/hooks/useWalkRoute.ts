import { useEffect, useState } from 'react';
import { decodePolyline } from '../lib/polyline';

export type WalkRoute = {
  meters: number;
  minutes: number;
  source: 'haversine' | 'onemap';
  /** Decoded route as a series of [lat, lng] points; empty until OneMap returns. */
  geometry: [number, number][];
};

type Coords = [number, number]; // [lat, lng]

/**
 * Resolves the actual walking distance/time between two points via the
 * OneMap routing proxy. While the request is in flight, the haversine
 * fallback is returned so the UI never flickers between blank and value.
 * On any failure (no token, no route, network), keeps the haversine value.
 */
export function useWalkRoute(
  from: Coords | null,
  to: Coords,
  haversineMeters: number,
  haversineMinutes: number,
): WalkRoute {
  const [route, setRoute] = useState<WalkRoute>({
    meters: haversineMeters,
    minutes: haversineMinutes,
    source: 'haversine',
    geometry: [],
  });

  useEffect(() => {
    if (!from) return;
    // Reset to haversine when the carpark changes — avoids briefly showing
    // the previous carpark's route after navigating.
    setRoute({
      meters: haversineMeters,
      minutes: haversineMinutes,
      source: 'haversine',
      geometry: [],
    });
    const ctrl = new AbortController();
    const url = `/api/onemap-route?start=${from[0]},${from[1]}&end=${to[0]},${to[1]}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((body: { ok: boolean; distance?: number; time?: number; geometry?: string }) => {
        if (!body.ok || body.distance == null || body.time == null) return;
        const geom = body.geometry ? decodePolyline(body.geometry) : [];
        setRoute({
          meters: body.distance,
          minutes: Math.max(1, Math.round(body.time / 60)),
          source: 'onemap',
          geometry: geom,
        });
      })
      .catch(() => {
        // Network or proxy failure → keep haversine, no UI surfacing.
      });
    return () => ctrl.abort();
    // Re-run when carpark or origin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.[0], from?.[1], to[0], to[1]]);

  return route;
}
