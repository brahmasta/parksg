import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistance } from '../lib/availability';
import { IconWalk } from './icons';

// OneMap raster tiles — free, CORS-enabled, rate-limited per IP.
// Styles: Default, Original, Grey, Night. "Grey" reads cleanly under
// the teal route line on our light theme.
const ONEMAP_TILE = 'https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png';
const ONEMAP_ATTRIBUTION =
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener">© OneMap</a>';

// OneMap's published bbox for Singapore. Pan is locked to this region so
// the user can't drag off the map.
const SG_BOUNDS = L.latLngBounds([1.144, 103.6], [1.494, 104.1]);

export function RealWalkMap({
  origin,
  destination,
  geometry,
  walkMin,
  walkMeters,
  height = 180,
}: {
  origin: [number, number];
  destination: [number, number];
  /** Decoded route as a series of [lat, lng] points */
  geometry: [number, number][];
  walkMin: number;
  walkMeters: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Same idea as RealResultsMap — only fit-bounds when the route actually
  // changes; otherwise preserve user zoom/pan.
  const fittedKey = useRef<string | null>(null);

  // Mount the map once.
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

  // Redraw markers + polyline whenever the route changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Wipe everything except the tile layer.
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const accent = getCssVar('--accent', '#0D9488');
    const accentOn = getCssVar('--accent-on', '#FFFFFF');
    const text1 = getCssVar('--text-1', '#242A33');

    // Route polyline (use real geometry; fall back to a straight line if empty)
    const path: [number, number][] = geometry.length >= 2 ? geometry : [origin, destination];
    const route = L.polyline(path, {
      color: accent,
      weight: 4,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Carpark pin — "P" inside a teal-outlined circle
    L.marker(origin, {
      icon: L.divIcon({
        className: 'psg-pin-origin',
        html: `<div style="
          width:26px;height:26px;border-radius:50%;
          background:#fff;border:2px solid ${accent};
          display:flex;align-items:center;justify-content:center;
          font-family: var(--font-mono); font-size:11px; font-weight:600;
          color:${accent}; box-shadow:0 2px 6px rgba(0,0,0,0.25);
        ">P</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    }).addTo(map);

    // Destination pin — solid dot
    L.marker(destination, {
      icon: L.divIcon({
        className: 'psg-pin-dest',
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:${text1}; border:2px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    }).addTo(map);

    // Fit to route with breathing room — only when the route key changes.
    const key = `${origin[0]},${origin[1]}->${destination[0]},${destination[1]}`;
    if (key !== fittedKey.current) {
      map.fitBounds(route.getBounds(), { padding: [28, 28], maxZoom: 17 });
      fittedKey.current = key;
    }

    // Make sure tiles render once the container is sized
    setTimeout(() => map.invalidateSize(), 50);

    // Silence unused-var lints for the colors we already passed inline.
    void accentOn;
  }, [origin[0], origin[1], destination[0], destination[1], geometry]);

  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bg-2)',
        border: '0.5px solid var(--line)',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Walk-time chip overlay */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 999,
          background: 'var(--glass)',
          border: '0.5px solid var(--line-strong)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: 'var(--text-1)',
          fontSize: 12,
          fontWeight: 500,
          zIndex: 500,
          pointerEvents: 'none',
        }}
      >
        <IconWalk size={13} stroke={2} />
        <span>{walkMin} min</span>
        <span style={{ opacity: 0.55 }}>·</span>
        <span style={{ opacity: 0.55 }}>{formatDistance(walkMeters)}</span>
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '6px 10px',
          borderRadius: 8,
          background: 'var(--glass)',
          border: '0.5px solid var(--line-strong)',
          fontSize: 10.5,
          fontFamily: 'var(--font-mono)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: 'var(--text-1)',
          zIndex: 500,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--accent)',
            }}
          />
          <span style={{ opacity: 0.68 }}>Carpark</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ width: 6, height: 6, borderRadius: 999, background: '#F5F6F8' }}
          />
          <span style={{ opacity: 0.68 }}>Destination</span>
        </div>
      </div>
    </div>
  );
}

function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
