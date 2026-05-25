/**
 * EV helpers — grouping connectors for the detail UI, summarising counts
 * for chips, and the single source of truth for "is this feed stale".
 *
 * Group key follows the spec: (plugType, current, kW, price, priceType).
 * Grouping is done client-side so it can evolve (e.g. folding operator
 * into the key) without a backend change.
 */

import type { Carpark, CarparkEV, EVConnector } from './types';
import { haversineMeters } from './geo';
import type { EvLocation } from './api/ltaEv';

/** LTA /EVCBatch refreshes every ~5 min. Anything older → treat as stale. */
export const EV_STALE_MINUTES = 5;

export type ConnectorGroup = {
  plugType: EVConnector['plugType'];
  current: EVConnector['current'];
  kw: number;
  price: number;
  priceType: EVConnector['priceType'];
  connectors: EVConnector[];
};

/** Group connectors by spec tuple, sorted fastest-first (kW desc). */
export function groupConnectors(connectors: EVConnector[]): ConnectorGroup[] {
  const groups = new Map<string, ConnectorGroup>();
  for (const c of connectors) {
    const key = `${c.plugType}__${c.current}__${c.kw}__${c.price}__${c.priceType}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        plugType: c.plugType,
        current: c.current,
        kw: c.kw,
        price: c.price,
        priceType: c.priceType,
        connectors: [],
      };
      groups.set(key, g);
    }
    g.connectors.push(c);
  }
  return [...groups.values()].sort((a, b) => b.kw - a.kw);
}

export type EVSummary = {
  available: number;
  total: number;
  minPrice: number | null;
  maxKw: number | null;
};

export function evSummary(ev: CarparkEV | null | undefined): EVSummary | null {
  if (!ev || !ev.hasCharging) return null;
  const list = ev.connectors ?? [];
  const available = list.filter((c) => c.status === 'Available').length;
  const total = list.length;
  const minPrice = list.length ? Math.min(...list.map((c) => c.price)) : null;
  const maxKw = list.length ? Math.max(...list.map((c) => c.kw)) : null;
  return { available, total, minPrice, maxKw };
}

/** True when the LTA snapshot age exceeds the staleness threshold. */
export function isEvStale(ev: CarparkEV | null | undefined): boolean {
  if (!ev || !ev.hasCharging) return false;
  if (ev.lastUpdatedMin == null) return true;
  return ev.lastUpdatedMin > EV_STALE_MINUTES;
}

/** Maximum distance between a carpark entrance and an EV location for them
 * to be considered the same physical site. Spec: ≤50 m. */
export const EV_JOIN_RADIUS_M = 50;

/** Spine join: for each carpark, find the nearest EV location within 50m
 * and attach its connectors as cp.ev. Carparks with no match keep ev
 * undefined. Pure function — returns a new array. */
export function attachEvData(
  carparks: Carpark[],
  locations: EvLocation[],
  ageMinutes: number,
): Carpark[] {
  if (carparks.length === 0 || locations.length === 0) return carparks;
  return carparks.map((cp) => {
    const cpPoint = { lat: cp.coords.entrance[0], lng: cp.coords.entrance[1] };
    let best: { loc: EvLocation; meters: number } | null = null;
    for (const loc of locations) {
      const meters = haversineMeters(cpPoint, loc);
      if (meters > EV_JOIN_RADIUS_M) continue;
      if (!best || meters < best.meters) best = { loc, meters };
    }
    if (!best) return cp;

    const counts = new Map<string, number>();
    for (const c of best.loc.connectors) {
      if (!c.operator) continue;
      counts.set(c.operator, (counts.get(c.operator) ?? 0) + 1);
    }
    const operators = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([op]) => op);

    return {
      ...cp,
      ev: {
        hasCharging: true,
        lastUpdatedMin: ageMinutes,
        operators,
        connectors: best.loc.connectors,
      },
    };
  });
}
