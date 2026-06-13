import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ONEMAP_TILE = 'https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png';
const ONEMAP_ATTRIBUTION =
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener">© OneMap</a>';
const SG_BOUNDS = L.latLngBounds([1.144, 103.6], [1.494, 104.1]);
const SG_CENTER: [number, number] = [1.3521, 103.8198];

/** Interactive Singapore map for picking a coordinate. Click anywhere or drag
 * the pin to set lat/lng; `onChange` reports the new position. When `lat`/`lng`
 * change from outside (e.g. a OneMap search pick), the marker + view recenter. */
export function LatLngPicker({
  lat,
  lng,
  onChange,
  height = 260,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Mount once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start: [number, number] = lat != null && lng != null ? [lat, lng] : SG_CENTER;
    const map = L.map(containerRef.current, {
      attributionControl: true,
      zoomControl: true,
      maxBounds: SG_BOUNDS,
      minZoom: 11,
      maxZoom: 19,
    }).setView(start, lat != null && lng != null ? 17 : 12);
    L.tileLayer(ONEMAP_TILE, {
      attribution: ONEMAP_ATTRIBUTION,
      detectRetina: true,
      bounds: SG_BOUNDS,
      className: 'psg-basemap',
    }).addTo(map);

    const marker = L.marker(start, { draggable: true });
    if (lat != null && lng != null) marker.addTo(map);
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      onChangeRef.current(round(ll.lat), round(ll.lng));
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng).addTo(map);
      onChangeRef.current(round(e.latlng.lat), round(e.latlng.lng));
    });
    mapRef.current = map;
    markerRef.current = marker;
    // Settle tiles after layout.
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when the coordinate changes from outside (search pick / typing).
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || lat == null || lng == null) return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - lat) < 1e-6 && Math.abs(cur.lng - lng) < 1e-6) return;
    marker.setLatLng([lat, lng]).addTo(map);
    map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '0.5px solid var(--line-strong)' }}
    />
  );
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
