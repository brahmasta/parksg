import * as L from 'leaflet';

/**
 * The OneMap basemap and the destination pin, shared by every Leaflet map in
 * the app (results map, detail walk map, admin coordinate picker).
 */

const ONEMAP_TILE = 'https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png';
const ONEMAP_ATTRIBUTION =
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener">© OneMap</a>';

/** OneMap's published bbox for Singapore; pan is locked to it. */
export const SG_BOUNDS = L.latLngBounds([1.144, 103.6], [1.494, 104.1]);

export const MAP_MIN_ZOOM = 11;
/** OneMap publishes tiles up to zoom 19 (zoom 20 comes back empty). */
const ONEMAP_NATIVE_MAX_ZOOM = 19;
/** One level past the last real tiles, upscaled, so a single building's
 *  entrances can be told apart. */
export const MAP_MAX_ZOOM = ONEMAP_NATIVE_MAX_ZOOM + 1;

/**
 * Adds the OneMap tile layer, usable all the way to MAP_MAX_ZOOM.
 *
 * Leaflet's tile layer defaults to maxZoom 18, and `detectRetina` takes one
 * more level off, so on a phone the tiles used to vanish past zoom 17 while
 * the map itself still zoomed to 19: a blank grey map. Here the layer covers
 * the map's whole range and upscales the deepest real tiles beyond it. On
 * retina screens Leaflet requests tiles one zoom deeper than the map's, so
 * the native limit is one lower there.
 */
export function addOneMapTiles(map: L.Map, options: L.TileLayerOptions = {}): L.TileLayer {
  const retina = L.Browser.retina;
  return L.tileLayer(ONEMAP_TILE, {
    attribution: ONEMAP_ATTRIBUTION,
    detectRetina: true,
    bounds: SG_BOUNDS,
    className: 'psg-basemap',
    minZoom: MAP_MIN_ZOOM,
    // detectRetina subtracts one from maxZoom; add it back.
    maxZoom: MAP_MAX_ZOOM + (retina ? 1 : 0),
    maxNativeZoom: ONEMAP_NATIVE_MAX_ZOOM - (retina ? 1 : 0),
    ...options,
  }).addTo(map);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The searched place: a solid teardrop pin with the place's name under it, so
 * it can't be mistaken for one of the carpark price pills around it.
 */
export function destinationPinIcon(label?: string | null): L.DivIcon {
  const name = label?.trim();
  const html = `
    <div class="psg-dest-pin">
      <div class="psg-dest-pin-halo"></div>
      <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true">
        <path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 10.9 12.6 21.9 14.4 23.4a1.7 1.7 0 0 0 2.2 0c1.8-1.5 14.4-12.5 14.4-23.4C32.5 8.3 25.6 1.5 17 1.5z"
          fill="var(--bad, #C0392B)" stroke="#fff" stroke-width="2.5"/>
        <circle cx="17" cy="16.5" r="5.5" fill="#fff"/>
      </svg>
      ${name ? `<div class="psg-dest-pin-label">${escapeHtml(name)}</div>` : ''}
    </div>`;
  return L.divIcon({
    className: 'psg-pin-dest',
    html,
    // Zero-size box anchored at the location; CSS hangs the pin's tip on it.
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Marker for the searched place. It sits under the carpark pills, which are
 *  the tap targets and carry the prices; when the place's own carpark shares
 *  the spot, the halo and the name under the pin still show around the pill. */
export function destinationMarker(coords: [number, number], label?: string | null): L.Marker {
  return L.marker(coords, {
    icon: destinationPinIcon(label),
    interactive: false,
    keyboard: false,
    zIndexOffset: -100,
  });
}
