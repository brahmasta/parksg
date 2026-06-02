import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Carpark, DurationHours } from '../lib/types';
import { availabilityStatus, formatCost } from '../lib/availability';

const ONEMAP_TILE = 'https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png';
const ONEMAP_ATTRIBUTION =
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener">© OneMap</a>';
const SG_BOUNDS = L.latLngBounds([1.144, 103.6], [1.494, 104.1]);

type Props = {
  carparks: Carpark[];
  /** ID of the cheapest carpark in the set, marked with the accent pill */
  cheapestId: string | null;
  duration: DurationHours;
  onSelect: (cp: Carpark) => void;
  degraded: boolean;
  destinationCoords: [number, number] | null;
  /** 'card' (default) = the mobile fixed-height card with padding; 'fill' =
   * fill the parent (desktop map pane), no padding/border/radius. */
  variant?: 'card' | 'fill';
  /** Optional arbitrary-duration cost (dollars) per carpark; null = unknown.
   * Falls back to the preset estByHours[duration] when omitted. */
  costOf?: (cp: Carpark) => number | null;
  /** Desktop: the hovered/selected carpark — emphasised, with a walk line drawn
   * to the destination. */
  activeId?: string | null;
};

export function RealResultsMap({ carparks, cheapestId, duration, onSelect, degraded, destinationCoords, variant = 'card', costOf, activeId }: Props) {
  const fill = variant === 'fill';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // We have to keep a stable handler ref because Leaflet markers don't
  // re-render with React — they're added imperatively. The selector closure
  // captures the *latest* onSelect via this ref.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Track which destination we've already fit bounds for, so the 60s lot-count
  // refresh (which recreates the carparks array) doesn't blow away the user's
  // zoom/pan position.
  const fittedForDest = useRef<string | null>(null);

  // Mount once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      attributionControl: true,
      zoomControl: false,
      maxBounds: SG_BOUNDS,
      minZoom: 11,
      maxZoom: 19,
    });
    L.tileLayer(ONEMAP_TILE, {
      attribution: ONEMAP_ATTRIBUTION,
      detectRetina: true,
      bounds: SG_BOUNDS,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw markers whenever the data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const accent = getCssVar('--accent', '#2EE3C2');
    const text1 = getCssVar('--text-1', '#0E1014');
    const bg1 = getCssVar('--bg-1', '#FFFFFF');
    const lineStrong = getCssVar('--line-strong', 'rgba(14,16,20,0.14)');
    const ok = getCssVar('--ok', '#1F8A4F');
    const warn = getCssVar('--warn', '#A66B00');
    const bad = getCssVar('--bad', '#C0392B');
    const muted = getCssVar('--muted-status', '#6B7280');

    const statusColor = (s: ReturnType<typeof availabilityStatus>) =>
      s === 'available' ? ok : s === 'limited' ? warn : s === 'full' ? bad : muted;

    // Walk line from the active carpark to the destination (desktop).
    if (activeId && destinationCoords) {
      const active = carparks.find((c) => c.id === activeId);
      if (active) {
        L.polyline([active.coords.entrance, destinationCoords], {
          color: accent,
          weight: 3,
          opacity: 0.85,
          dashArray: '1 7',
          lineCap: 'round',
        }).addTo(map);
      }
    }

    // Destination marker — central solid dot
    if (destinationCoords) {
      L.marker(destinationCoords, {
        icon: L.divIcon({
          className: 'psg-pin-dest',
          html: `<div style="
            width:16px;height:16px;border-radius:50%;
            background:${text1}; border:2px solid #fff;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        // Always rendered behind the carpark pins; they tap-target priority.
        zIndexOffset: -100,
      }).addTo(map);
    }

    // Carpark pins — cost label with a small tail
    carparks.forEach((cp) => {
      const isCheapest = cp.id === cheapestId;
      const isActive = cp.id === activeId;
      const isGoogle = cp.source === 'GOOGLE';
      const status = availabilityStatus(degraded ? null : cp.lotsAvailable);
      const dotColor = statusColor(status);
      const costNum = costOf ? costOf(cp) : cp.rateUnknown ? null : cp.estByHours[duration];
      const cost = costNum == null ? '—' : formatCost(costNum);
      const fill = isCheapest ? accent : bg1;
      const fg = isCheapest ? '#0E1014' : isGoogle ? muted : text1;
      // Active pin gets an accent ring; cheapest a solid accent border; Google a
      // muted dashed border (supplementary/unverified); else a hairline.
      const border = isActive
        ? `1.5px solid ${accent}`
        : isCheapest
        ? `0.5px solid ${accent}`
        : isGoogle
        ? `0.5px dashed ${muted}`
        : `0.5px solid ${lineStrong}`;

      const html = `
        <div style="
          display:flex; flex-direction:column; align-items:center;
          transform: translate(-50%, -100%);
        ">
          <div style="
            display:flex; align-items:center; gap:6px;
            padding:5px 9px; border-radius:999px;
            background:${fill}; color:${fg};
            border:${border};
            font-family: var(--font-display);
            font-size:12.5px; font-weight:600;
            box-shadow:0 4px 12px rgba(0,0,0,0.2);
            white-space:nowrap;
          ">
            <span style="
              width:6px;height:6px;border-radius:999px;background:${dotColor};
            "></span>
            ${cost}
          </div>
          <div style="
            width:2px; height:10px;
            background:${isCheapest ? accent : text1};
            opacity:0.6;
          "></div>
        </div>
      `;

      const marker = L.marker(cp.coords.entrance, {
        icon: L.divIcon({
          className: 'psg-pin-cp',
          html,
          // Anchor the tail tip at the actual location; the pill floats above.
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        zIndexOffset: isActive ? 1200 : isCheapest ? 1000 : 0,
        riseOnHover: true,
        keyboard: true,
      });
      marker.on('click', () => onSelectRef.current(cp));
      marker.addTo(map);
    });

    // Fit bounds only the first time we render *actual* data for a given
    // destination. We deliberately skip the fit if there are no points yet
    // (e.g. mounted during loading) so the next render with real data still
    // gets a chance to set the viewport. After fitting once, lot-count
    // refreshes and duration toggles keep the user's pan/zoom intact.
    const destKey = destinationCoords ? destinationCoords.join(',') : '';
    const points: [number, number][] = [
      ...carparks.map((c) => c.coords.entrance),
      ...(destinationCoords ? [destinationCoords] : []),
    ];
    if (destKey !== fittedForDest.current && points.length > 0) {
      if (points.length === 1) {
        map.setView(points[0], 16);
      } else {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
      }
      fittedForDest.current = destKey;
    }

    // Make sure tiles render after container layout settles.
    setTimeout(() => map.invalidateSize(), 50);
  }, [carparks, cheapestId, duration, degraded, destinationCoords, costOf, activeId]);

  return (
    <div style={fill ? { height: '100%', display: 'flex', flexDirection: 'column' } : { padding: '0 16px' }}>
      <div
        style={{
          position: 'relative',
          height: fill ? 'auto' : 460,
          flex: fill ? 1 : undefined,
          minHeight: 0,
          borderRadius: fill ? 0 : 14,
          overflow: 'hidden',
          background: 'var(--bg-1)',
          border: fill ? 'none' : '0.5px solid var(--line)',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div
        style={{
          marginTop: fill ? 0 : 8,
          padding: fill ? '8px 16px' : '0 4px',
          fontSize: 11,
          color: 'var(--text-3)',
          textAlign: 'center',
          flexShrink: fill ? 0 : undefined,
        }}
      >
        Tap a pin to view the carpark
        {carparks.some((c) => c.source === 'GOOGLE') &&
          ' · Dashed pins powered by Google (unverified)'}
      </div>
    </div>
  );
}

function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
