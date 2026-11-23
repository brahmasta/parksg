// wheretopark.sg beta: the toy 3D map with search -> results -> carpark details -> navigate.
// Plain script, no build step. The 3D blocks and trees are drawn by toy3d.js on top of this map.
// Live data: /api/car/nearby (prices, free lots, EV) and /api/onemap-route (walking route) from this site,
// place search from OneMap (the Singapore government geocoder).

const $ = id => document.getElementById(id);
const q = $('q'), body = document.body;
const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: carry on without it */ } },
};
const ICON = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>',
  saved: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.200 2.800 1-5.900L3.500 9.700l5.900-.800z"/></svg>',
  recent: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/></svg>',
  cp: '<b style="font:700 17px \'Space Grotesk\',system-ui,sans-serif">P</b>',
  '': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.300-7-11.500A7 7 0 0 1 19 9.500c0 5.200-7 11.500-7 11.500z"/><circle cx="12" cy="9.500" r="2.500"/></svg>',
};
const STAR = on => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900L3.500 9.700l5.900-.8z"/></svg>`;

// ---------- what the mockup remembers (this browser only) ----------
const SAVED_PLACES = [];                               // no account in the beta: only what this browser remembers
let recents = store.get('toy.recents', []);            // places picked from search
let savedCps = store.get('toy.savedCarparks', []);     // starred carparks
let stay = store.get('toy.stay', 2);
const STAYS = [1, 2, 3, 4, 8];
const stayLabel = h => `${h} h`;

// ---------- the flat map under the toy pieces (OpenFreeMap tiles, our own toy colours) ----------
const HOME = [103.8562, 1.2868];                      // start over Marina Bay, looking at the city
const KX = 111320 * Math.cos(1.35 * Math.PI / 180), KY = 110574;
const SG_BOUNDS = [[103.55, 1.15], [104.1, 1.49]];
const HOME_VIEW = { center: HOME, zoom: 15.5, pitch: 60 };
const homePad = () => ({ top: 0, left: 0, right: 0, bottom: 90 });
const metresFrom = (a, b) => Math.hypot((a.lng - b.lng) * KX, (a.lat - b.lat) * KY);
const W = ['match', ['get', 'class'], 'motorway', 15, 'trunk', 13, 'primary', 12, 'secondary', 10, 'tertiary', 8.5, 'minor', 7, 'service', 4.5, 'path', 2, 6];
const metres = (m, extra = 0) => ['interpolate', ['exponential', 2], ['zoom'], 12, ['*', ['+', m, extra], 4096 / 78250], 22, ['*', ['+', m, extra], 4194304 / 78250]];
const ROAD = ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'brunnel'], 'tunnel'],
  ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]]];
const round = { 'line-cap': 'round', 'line-join': 'round' };
const src = name => ({ source: 'omt', 'source-layer': name });
const STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  light: { anchor: 'map', color: '#ffffff', intensity: 0.42, position: [1.4, 130, 42] },
  sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#c8e9a6' } },
    { id: 'green', type: 'fill', ...src('landcover'), paint: { 'fill-color': ['match', ['get', 'class'], 'wood', '#a5d889', 'sand', '#f3e7c0', '#b6e195'] } },
    { id: 'park', type: 'fill', ...src('park'), paint: { 'fill-color': '#b6e195', 'fill-opacity': 0.7 } },
    { id: 'play', type: 'fill', ...src('landuse'), filter: ['in', ['get', 'class'], ['literal', ['pitch', 'playground', 'track']]],
      paint: { 'fill-color': ['match', ['get', 'class'], 'playground', '#ffd98a', '#f6b27a'] } },
    { id: 'water', type: 'fill', ...src('water'), paint: { 'fill-color': '#7fd3f2' } },
    { id: 'stream', type: 'line', ...src('waterway'), layout: round, paint: { 'line-color': '#7fd3f2', 'line-width': metres(4) } },
    { id: 'runway', type: 'line', ...src('aeroway'), filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#aab4bf', 'line-width': metres(['match', ['get', 'class'], 'runway', 45, 16]) } },
    { id: 'paths', type: 'line', ...src('transportation'), minzoom: 15.2, filter: ['all', ['==', ['get', 'class'], 'path'], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: round, paint: { 'line-color': '#f6ecd2', 'line-width': metres(2) } },
    { id: 'kerb', type: 'line', ...src('transportation'), minzoom: 12, filter: ROAD, layout: round, paint: { 'line-color': '#eef1f4', 'line-width': metres(W, 2.2) } },
    { id: 'roads', type: 'line', ...src('transportation'), filter: ROAD, layout: round,
      paint: { 'line-color': ['match', ['get', 'class'], 'service', '#98a3af', '#76828f'], 'line-width': metres(W) } },
    { id: 'rail', type: 'line', ...src('transportation'), minzoom: 12, filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': '#5f6f80', 'line-width': metres(2.5), 'line-dasharray': [3, 2] } },
    // zoomed out, simple blocks stand in for the toy pieces (toy3d.js takes over from zoom 14.7)
    { id: 'far-blocks', type: 'fill-extrusion', ...src('building'), minzoom: 13, maxzoom: 14.7, filter: ['!=', ['get', 'hide_3d'], true],
      paint: { 'fill-extrusion-color': '#f3ead9', 'fill-extrusion-height': ['*', ['get', 'render_height'], 1.3], 'fill-extrusion-base': ['*', ['get', 'render_min_height'], 1.3], 'fill-extrusion-opacity': 0.92 } },
    // street names are left out for now: map labels always draw on top, so they would float over the towers
    { id: 'place-name', type: 'symbol', ...src('place'), minzoom: 10.5, maxzoom: 14.7, filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood', 'quarter', 'island']]],
      layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 15], 'text-max-width': 7 },
      paint: { 'text-color': '#1d2b3a', 'text-halo-color': 'rgba(255,255,255,.92)', 'text-halo-width': 1.8 } },
  ],
};
const map = new maplibregl.Map({
  container: 'map', style: STYLE, ...HOME_VIEW, bearing: -28,
  minZoom: 10.5, maxZoom: 19.6, maxPitch: 68, maxBounds: SG_BOUNDS, attributionControl: false, antialias: true,
});
map.touchZoomRotate.enable();
map.touchPitch.enable();
let ready = false;
map.once('load', () => { ready = true; });

// ---------- state ----------
let spinning = true, flat = false, pin = null, bubbles = [], current = null, picked = null, focused = null, routeId = 0;
let results = [], live = false, checkedAt = null, loadState = 'idle', reqId = 0;
let sortBy = 'cost', onlyFree = false, onlyEv = false;
let hits = [], remote = [], remoteFor = '', searching = false, searchTimer = 0;
const setState = s => { body.classList.remove('home', 'typing', 'results'); body.classList.add(s); };
const sheetPad = () => ({ top: 70, left: 0, right: 0, bottom: Math.min($('sheet').offsetHeight || 320, innerHeight * 0.56) });
const syncSheet = () => body.style.setProperty('--sheet', ($('sheet').offsetHeight || 320) + 'px');
let toastTimer = 0;
const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800); };

// ---------- search ----------
const rowHtml = (p, i) => `<button type="button" class="row" data-i="${i}"><span class="ic ${p.kind === 'home' || p.kind === 'saved' || p.kind === 'cp' ? '' : 'plain'}">${ICON[p.kind || '']}</span>
  <div><b>${esc(p.label || p.name)}</b>${p.label || p.addr ? `<small>${esc(p.label ? p.name : p.addr)}</small>` : ''}</div></button>`;

function suggest() {
  const term = q.value.trim().toLowerCase();
  const match = p => !term || ((p.label || '') + ' ' + p.name + ' ' + (p.addr || '')).toLowerCase().includes(term);
  const places = SAVED_PLACES.filter(match);
  const carparks = savedCps.filter(match).map(c => ({ ...c, kind: 'cp', addr: 'Saved carpark' }));
  const recent = term ? [] : recents.map(r => ({ ...r, kind: 'recent' }));
  const found = term.length >= 2 && remoteFor === term ? remote.map(r => ({ ...r, kind: '' })) : [];
  hits = [...places, ...carparks, ...recent, ...found];
  let n = 0;
  const block = (title, list) => list.length ? `<h2 style="margin-top:${n ? 12 : 0}px">${title}</h2>` + list.map(p => rowHtml(p, n++)).join('') : '';
  let html = block('Saved places', places) + block('Saved carparks', carparks) + block('Recent', recent) + block('Places', found);
  if (term.length >= 2 && (searching || remoteFor !== term)) html += '<p>Searching Singapore…</p>';
  else if (term.length >= 2 && !hits.length) html += '<p>No place found for that. Try a building name, a street or a postal code.</p>';
  else if (!term && !hits.length) html += '<p>Type a place, a street or a postal code to search all of Singapore.</p>';
  $('sugg').innerHTML = html;

  clearTimeout(searchTimer);
  if (term.length >= 2 && remoteFor !== term) {
    searching = true;
    searchTimer = setTimeout(async () => {
      let list = [];
      try { list = await findPlaces(term); } catch { list = []; }
      if (q.value.trim().toLowerCase() !== term) return;
      remote = list; remoteFor = term; searching = false; suggest();
    }, 260);
  } else searching = false;
  return hits;
}

// OneMap search, tidied into { name, addr, lat, lng }
const titleCase = t => t.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bHdb\b/g, 'HDB').replace(/\bMrt\b/g, 'MRT');
async function findPlaces(term) {
  const res = await fetch('https://www.onemap.gov.sg/api/common/elastic/search?returnGeom=Y&getAddrDetails=Y&pageNum=1&searchVal=' + encodeURIComponent(term));
  if (!res.ok) throw new Error(res.status);
  const seen = new Set(), places = [];
  for (const r of (await res.json()).results || []) {
    const lat = Number(r.LATITUDE), lng = Number(r.LONGITUDE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const named = r.BUILDING && r.BUILDING !== 'NIL';
    const addr = titleCase([r.BLK_NO !== 'NIL' ? r.BLK_NO : '', r.ROAD_NAME !== 'NIL' ? r.ROAD_NAME : ''].filter(Boolean).join(' '));
    const postal = r.POSTAL && r.POSTAL !== 'NIL' ? r.POSTAL : '';
    const name = named ? titleCase(r.BUILDING) : addr || titleCase(r.SEARCHVAL || '');
    if (!name || seen.has(name + '|' + postal)) continue;
    seen.add(name + '|' + postal);
    places.push({ name, addr: [named ? addr : '', postal ? 'Singapore ' + postal : ''].filter(Boolean).join(', '), lat, lng });
    if (places.length === 7) break;
  }
  return places;
}

function choose(p) {
  if (!p) return;
  if (p.kind === '' || p.kind === 'recent') {              // remember searches, newest first
    recents = [{ name: p.name, addr: p.addr || '', lat: p.lat, lng: p.lng }, ...recents.filter(r => r.name !== p.name)].slice(0, 5);
    store.set('toy.recents', recents);
  }
  showResults(p, p.kind === 'cp' ? p.id : null);
}

// ---------- results ----------
function clearMarkers() { pin && pin.remove(); pin = null; bubbles.forEach(b => b.m.remove()); bubbles = []; }
function walkLine(path) {
  const data = path ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } } : { type: 'FeatureCollection', features: [] };
  try {
    if (map.getSource('walk')) return map.getSource('walk').setData(data);
    map.addSource('walk', { type: 'geojson', data });
    map.addLayer({ id: 'walk', type: 'line', source: 'walk', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ff6b4a', 'line-width': 5, 'line-dasharray': [0.1, 1.7] } }, map.getLayer('three3d') ? 'three3d' : undefined);
  } catch { /* style still loading: the line is decoration, skip it */ }
}

const view = () => {
  let list = results.filter(c => (!onlyFree || c.lotsAvailable > 0) && (!onlyEv || c.evTotal > 0));
  if (sortBy === 'near') list = [...list].sort((a, b) => a.distanceM - b.distanceM);
  return list;                                             // the service already ranks cheapest first
};
const best = () => results.reduce((a, c) => c.cost != null && (!a || c.cost < a.cost) ? c : a, null);
// The service lists cheapest first, except that the searched place's own carpark is put on top.
const atDest = () => current && current.kind !== 'here' && results.length > 1 && results[0].cost != null && results[1].cost != null && results[0].cost > results[1].cost ? results[0] : null;
const lotsText = c => c.lotsAvailable == null ? 'no live lot data' : c.lotsAvailable > 0 ? `<em>${c.lotsAvailable} lots free</em>` : 'full right now';
const money = c => c.cost == null ? '–' : c.cost === 0 ? 'Free' : '$' + c.cost.toFixed(2);

function renderControls() {
  $('ctl').innerHTML = STAYS.map(h => `<button type="button" class="chip ${h === stay ? 'on' : ''}" data-stay="${h}">${stayLabel(h)}</button>`).join('') +
    '<span class="sep"></span>' +
    `<button type="button" class="chip ${sortBy === 'cost' ? 'on' : ''}" data-sort="cost">Cheapest</button>` +
    `<button type="button" class="chip ${sortBy === 'near' ? 'on' : ''}" data-sort="near">Nearest</button>` +
    '<span class="sep"></span>' +
    `<button type="button" class="chip ${onlyFree ? 'on' : ''}" data-f="free">Lots free</button>` +
    `<button type="button" class="chip ${onlyEv ? 'on' : ''}" data-f="ev">EV charging</button>`;
}

function renderResults() {
  renderControls();
  const list = loadState === 'ok' ? view() : [], top = best(), here = atDest();
  const tagFor = c => (here && c.id === here.id ? '<span class="tag dest">At destination</span>' : '') + (top && c.id === top.id ? '<span class="tag">Cheapest</span>' : '');
  bubbles.forEach(b => b.m.remove()); bubbles = [];
  if (focused && !list.some(c => c.id === focused.id)) focused = null;
  if (loadState === 'loading') {
    $('sheetTitle').textContent = 'Finding carparks'; $('sheetSub').textContent = '';
    $('list').innerHTML = '<p class="loading">Checking prices and free lots…</p>';
  } else if (loadState === 'error') {
    $('sheetTitle').textContent = 'Could not load carparks'; $('sheetSub').textContent = '';
    $('list').innerHTML = '<p class="empty">The carpark service did not answer.</p><button type="button" class="chip retry" id="retry">Try again</button>';
  }
  // the collapsed strip: one card per carpark, swiped sideways, so the map stays in view
  $('peekTitle').textContent = loadState === 'ok' ? (results.length ? `${list.length} carpark${list.length === 1 ? '' : 's'}` : 'No carparks nearby') : loadState === 'error' ? 'Could not load carparks' : 'Finding carparks';
  $('peekSub').textContent = loadState === 'ok' && results.length ? `${sortBy === 'near' ? 'nearest' : 'cheapest'} first · ${stayLabel(stay)}` : '';
  $('more').hidden = loadState !== 'ok' || !results.length;
  $('cards').innerHTML = loadState === 'loading' ? '<p class="loading">Checking prices and free lots…</p>'
    : loadState === 'error' ? '<p class="empty">The carpark service did not answer.</p><button type="button" class="chip retry" data-retry>Try again</button>'
    : list.length ? list.map(c => `<button type="button" class="card ${focused && focused.id === c.id ? 'on' : ''}" data-id="${esc(c.id)}">
        <b>${esc(c.name)}</b>
        <span class="price"><strong>${c.cost == null ? 'Rate not known' : money(c)}</strong>${c.cost == null ? '' : `<small>for ${stayLabel(stay)}</small>`}</span>
        <small>${c.walkMin} min walk · ${lotsText(c)}</small>
        <span class="tags">${tagFor(c)}${c.evTotal > 0 ? '<span class="tag ev">EV</span>' : ''}<i>Details</i></span></button>`).join('')
    : `<p class="empty">${results.length ? 'No carpark matches those filters.' : 'We have no carparks within 600 m of this place.'}</p>`;
  if (loadState === 'ok') {
    $('sheetTitle').textContent = results.length ? `${list.length} carpark${list.length === 1 ? '' : 's'} within 600 m` : 'No carparks nearby';
    $('sheetSub').textContent = results.length ? `price for ${stayLabel(stay)}${live ? '' : ' · live lots unavailable'}` : '';
    $('list').innerHTML = list.length ? list.map(c => `<button type="button" class="cp ${picked && picked.id === c.id ? 'on' : ''}" data-id="${esc(c.id)}"><span class="p">P</span>
        <div><b>${esc(c.name)}</b><small>${c.walkMin} min walk · ${lotsText(c)}${tagFor(c)}${c.evTotal > 0 ? '<span class="tag ev">EV</span>' : ''}</small></div>
        <strong>${money(c)}<small>${c.cost == null ? 'rate not known' : stayLabel(stay)}</small></strong></button>`).join('')
      : `<p class="empty">${results.length ? 'No carpark matches those filters.' : 'We have no carparks within 600 m of this place.'}</p>`;
    list.forEach((c, k) => {
      const lots = c.lotsAvailable == null ? '' : `<small>${c.lotsAvailable} lots</small>`;       // nothing shown when there is no live count
      const lit = picked ? picked.id === c.id : focused && focused.id === c.id;
      // busy areas can have dozens: the first 14 get full bubbles, the rest a small price tag
      const node = el('bub' + (lit ? ' on' : '') + (k >= 14 ? ' mini' : ''), `<i>${c.cost == null ? 'no rate' : money(c)} ${lots}</i>`);
      node.style.animationDelay = (k * 50) + 'ms';
      // collapsed: first tap picks the card, second tap opens it; in the full list a tap opens it
      node.onclick = e => { e.stopPropagation(); if (picked || body.classList.contains('list') || (focused && focused.id === c.id)) openDetail(c); else focus(c); };
      const m = new maplibregl.Marker({ element: node, anchor: 'bottom' }).setLngLat([c.lng, c.lat]).addTo(map);
      m.getElement().style.zIndex = String(100 - k);
      bubbles.push({ c, m });
    });
  }
  requestAnimationFrame(syncSheet);
}

async function loadCarparks(openId) {
  const p = current, id = ++reqId;
  loadState = 'loading'; results = []; renderResults();
  try {
    const j = await (await fetch(`/api/car/nearby?lat=${(+p.lat).toFixed(6)}&lng=${(+p.lng).toFixed(6)}&hours=${stay}&limit=60${p.kind === 'here' ? '' : '&label=' + encodeURIComponent(p.name)}`)).json();
    if (id !== reqId) return;
    if (!j.ok) throw new Error(j.error || 'failed');
    results = j.carparks || []; live = !!j.live; checkedAt = new Date(); loadState = 'ok';
  } catch {
    if (id !== reqId) return;
    loadState = 'error';
  }
  renderResults();
  if (loadState !== 'ok') return;
  const again = (picked && results.find(c => c.id === picked.id)) || (openId && results.find(c => c.id === openId));
  if (again) openDetail(again, true); else if (picked) closeDetail(true);
  if (!focused && view().length) focus(view()[0], false, true);
}

async function showResults(p, openId) {
  current = p; picked = null; focused = null; body.classList.remove('detail', 'list');
  q.value = p.label ? `${p.label} · ${p.name}` : p.name; q.blur();
  spinning = false; clearMarkers(); walkLine(null); setState('results');
  loadCarparks(openId);
  if (current !== p) return;
  const c = map.getCenter(), far = metresFrom(p, { lng: c.lng, lat: c.lat }) > 1500;
  if (far) map.jumpTo({ center: [p.lng, p.lat], zoom: 15.2, pitch: 35 });
  map.easeTo({ center: [p.lng, p.lat], zoom: 16.75, pitch: flat ? 0 : 56, padding: sheetPad(), duration: far ? 1500 : 1800, easing: t => 1 - Math.pow(1 - t, 3) });
  setTimeout(() => {
    if (current !== p || pin) return;
    pin = new maplibregl.Marker({ element: el('pin', `<i>${esc(p.label || p.name)}</i>`), anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
  }, 700);
}

function goHome() {
  ++reqId; ++routeId; clearMarkers(); walkLine(null); current = null; picked = null; focused = null; q.value = ''; q.blur(); flat = false; $('tilt').textContent = 'Flat map';
  body.classList.remove('detail', 'list'); setState('home');
  const c = map.getCenter();
  if (metresFrom({ lng: c.lng, lat: c.lat }, { lng: HOME[0], lat: HOME[1] }) > 2500) map.jumpTo({ ...HOME_VIEW, zoom: 15.6, padding: homePad() });
  map.easeTo({ ...HOME_VIEW, padding: homePad(), duration: 1400 });
  spinning = true;
}

// ---------- carpark details ----------
const isSaved = c => savedCps.some(s => s.id === c.id);
function openDetail(c, keepCamera) {
  if (!keepCamera) body.classList.remove('dfull');
  picked = c;
  const rates = c.rateLines && c.rateLines.length
    ? `<ul class="rates">${c.rateLines.map(l => { const i = l.indexOf(': '); return `<li><span>${esc(i > 0 ? l.slice(0, i) : 'Rate')}</span><b>${esc(i > 0 ? l.slice(i + 2) : l)}</b></li>`; }).join('')}</ul>`
    : '<p class="unknown">We do not have the rates for this carpark yet, so no price is shown.</p>';
  const lots = c.lotsAvailable == null ? '<b class="none">No data</b><small>live lots</small>'
    : `<b class="${c.lotsAvailable > 0 ? 'good' : ''}">${c.lotsAvailable}</b><small>${c.lotsTotal ? `of ${c.lotsTotal} lots free` : 'lots free now'}</small>`;
  const facts = [
    c.evTotal > 0 ? `<span class="fact">EV charging: ${c.evAvailable == null ? c.evTotal + ' points' : `${c.evAvailable} of ${c.evTotal} free`}</span>` : '',
    c.evOperators && c.evOperators.length ? `<span class="fact">Charging by ${esc(c.evOperators.join(', '))}</span>` : '',
    c.motorcycle ? `<span class="fact plain">Motorcycle lots${c.motorcycleLots ? ': ' + c.motorcycleLots : ''}</span>` : '',
    c.heavy ? `<span class="fact plain">Heavy vehicle lots${c.heavyLots ? ': ' + c.heavyLots : ''}</span>` : '',
    c.heightLimitM ? `<span class="fact plain">Height limit ${c.heightLimitM} m</span>` : '',
    c.lotsAvailable == null && c.lotsTotal ? `<span class="fact plain">${c.lotsTotal} lots in total</span>` : '',
  ].join('');
  $('detail').innerHTML = `<div class="d-top"><span class="p">P</span><div><h1>${esc(c.name)}</h1>${c.subtitle && c.subtitle.toLowerCase() !== c.name.toLowerCase() ? `<p>${esc(c.subtitle)}</p>` : ''}</div></div>
    <div class="stats">
      <div class="stat"><b class="${c.cost == null ? 'none' : ''}">${c.cost == null ? 'Not known' : money(c)}</b><small>${c.cost == null ? 'price' : 'for ' + stayLabel(stay)}</small></div>
      <div class="stat"><b id="walkB">${c.walkMin} min</b><small id="walkS">${c.distanceM} m walk</small></div>
      <div class="stat">${lots}</div>
    </div>
    <div class="btns"><button type="button" class="btn go" id="go"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.500l7 2.500 2.500 7z"/></svg>Navigate</button>
      <button type="button" class="btn sq ${isSaved(c) ? 'on' : ''}" id="star" aria-label="${isSaved(c) ? 'Remove from saved' : 'Save this carpark'}" aria-pressed="${isSaved(c)}">${STAR(isSaved(c))}</button>
      <button type="button" class="btn sq" id="share" aria-label="Share this carpark"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 7.500L12 3.500l4 4M6 11.500H5a1 1 0 0 0-1 1V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.500a1 1 0 0 0-1-1h-1"/></svg></button></div>
    <div class="extra">${facts ? `<div class="facts">${facts}</div>` : ''}
    <h2>Rates today</h2>${rates}
    <p class="fine">Live from wheretopark.sg${checkedAt ? ', checked ' + checkedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}. Prices are estimates; check the signboard on entry.</p></div>
    <button type="button" class="morelink" id="dmore">Rates and more</button>`;
  body.classList.add('detail');
  bubbles.forEach(b => b.m.getElement().classList.toggle('on', b.c.id === c.id));
  // straight line at once, then the real walking route when it arrives (kept straight if the service fails)
  const ends = [[c.lng, c.lat], [current.lng, current.lat]], rid = ++routeId, dest = current;
  walkLine(ends);
  fetch(`/api/onemap-route?start=${c.lat.toFixed(6)},${c.lng.toFixed(6)}&end=${(+dest.lat).toFixed(6)},${(+dest.lng).toFixed(6)}`).then(r => r.json()).then(j => {
    if (rid !== routeId || picked !== c || !j.ok || j.distance == null) return;
    const line = j.geometry ? decodeLine(j.geometry) : [];
    if (line.length > 1) walkLine([ends[0], ...line, ends[1]]);
    if ($('walkB')) { $('walkB').textContent = Math.max(1, Math.round(j.time / 60)) + ' min'; $('walkS').textContent = `${j.distance} m walk`; }
  }).catch(() => {});
  requestAnimationFrame(() => { syncSheet(); if (!keepCamera && picked === c) map.easeTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 17.1), padding: sheetPad(), duration: 900 }); });
}
// Google's encoded polyline (precision 5), which the route service returns; gives [lng, lat] pairs
function decodeLine(str) {
  const out = []; let i = 0, lat = 0, lng = 0;
  const next = () => { let r = 0, shift = 0, b; do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << shift; shift += 5; } while (b >= 32); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < str.length) { lat += next(); lng += next(); out.push([lng / 1e5, lat / 1e5]); }
  return out;
}
function closeDetail(quiet) {
  picked = null; ++routeId; body.classList.remove('detail', 'dfull'); walkLine(null); renderResults();
  if (!quiet) requestAnimationFrame(() => { if (current) map.easeTo({ center: [current.lng, current.lat], zoom: 16.75, padding: sheetPad(), duration: 900 }); });
}

// ---------- share ----------
// A link back to this page that reopens the same search with this carpark's details showing.
function shareUrl(c) {
  const p = new URLSearchParams({ to: `${(+current.lat).toFixed(6)},${(+current.lng).toFixed(6)}`, dest: current.label || current.name, cp: c.id });
  return `${location.origin}/beta?${p}`;
}
async function shareCarpark(c) {
  const url = shareUrl(c), title = `${c.name} · wheretopark.sg`;
  const text = `Parking at ${c.name}${c.cost == null ? '' : `: ${money(c)} for ${stayLabel(stay)}`}`;
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }   // closed the share sheet
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Could not copy the link'); }
}
// opening a shared link: /beta?to=lat,lng&dest=Name&cp=carpark-id
function openShared() {
  const p = new URLSearchParams(location.search), to = (p.get('to') || '').split(',').map(Number);
  if (to.length !== 2 || !Number.isFinite(to[0]) || !Number.isFinite(to[1]) || to[0] < 1.15 || to[0] > 1.49 || to[1] < 103.55 || to[1] > 104.1) return;
  const name = (p.get('dest') || 'Shared place').slice(0, 80);
  history.replaceState(null, '', location.pathname);
  showResults({ name, lat: to[0], lng: to[1], kind: '' }, p.get('cp'));
}

// ---------- navigate ----------
const APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const NAV = [
  { id: 'google', name: 'Google Maps', tint: '#34a853', mark: 'G', url: (a, b) => `https://www.google.com/maps/dir/?api=1&destination=${a},${b}&travelmode=driving` },
  { id: 'waze', name: 'Waze', tint: '#33ccff', mark: 'W', url: (a, b) => `https://waze.com/ul?ll=${a},${b}&navigate=yes` },
  { id: 'apple', name: 'Apple Maps', tint: '#5b6b7c', mark: 'A', url: (a, b) => `https://maps.apple.com/?daddr=${a},${b}&dirflg=d` },
].filter(n => n.id !== 'apple' || APPLE);
function openNavigate(c) {
  const last = store.get('toy.nav', '');
  $('navTitle').textContent = 'Navigate to ' + c.name;
  $('navList').innerHTML = [...NAV].sort((a, b) => (b.id === last) - (a.id === last)).map(n =>
    `<a href="${n.url(c.lat, c.lng)}" target="_blank" rel="noopener" data-nav="${n.id}"><i style="background:${n.tint}">${n.mark}</i>${n.name}${n.id === last ? '<small>Last used</small>' : ''}</a>`).join('');
  $('nav').classList.add('open');
}
const closeNavigate = () => $('nav').classList.remove('open');

// ---------- wiring ----------
q.addEventListener('focus', () => { if (!body.classList.contains('typing')) { q.select(); body.classList.remove('detail'); suggest(); setState('typing'); spinning = false; } });
q.addEventListener('input', () => { suggest(); setState('typing'); });
$('search').addEventListener('submit', e => { e.preventDefault(); const h = suggest(); if (h.length) choose(h[0]); });
$('sugg').addEventListener('click', e => { const r = e.target.closest('.row'); if (r) choose(hits[+r.dataset.i]); });
const back = () => { if ($('nav').classList.contains('open')) closeNavigate(); else if (body.classList.contains('detail')) closeDetail(); else if (body.classList.contains('results') && body.classList.contains('list')) setList(false); else if (body.classList.contains('typing') && current) { q.blur(); showResults(current); } else goHome(); };
$('back').onclick = back;
addEventListener('keydown', e => { if (e.key === 'Escape') back(); });
$('clear').onclick = () => { q.value = ''; q.focus(); body.classList.remove('detail'); suggest(); setState('typing'); };
// the browser's real location (it asks for permission the first time)
$('locate').onclick = () => {
  const b = $('locate'); if (b.classList.contains('busy')) return;
  if (!navigator.geolocation) return toast('This browser cannot share a location.');
  b.classList.add('busy');
  navigator.geolocation.getCurrentPosition(pos => {
    b.classList.remove('busy');
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    if (lat < 1.15 || lat > 1.49 || lng < 103.55 || lng > 104.1) return toast('wheretopark.sg covers Singapore only.');
    showResults({ label: '', name: 'Your location', lat, lng, kind: 'here' });
  }, err => {
    b.classList.remove('busy');
    toast(err.code === 1 ? 'Location is blocked. Allow it in your browser to use this.' : 'Could not find your location. Try again.');
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
};

// ---------- collapsed strip <-> full list ----------
function focus(c, fromSwipe, quiet) {
  focused = c;
  bubbles.forEach(b => b.m.getElement().classList.toggle('on', b.c.id === c.id));
  let card = null;
  document.querySelectorAll('#cards .card').forEach(n => { const on = n.dataset.id === c.id; n.classList.toggle('on', on); if (on) card = n; });
  if (card && !fromSwipe) $('cards').scrollTo({ left: card.offsetLeft - ($('cards').clientWidth - card.offsetWidth) / 2, behavior: quiet ? 'auto' : 'smooth' });
  if (quiet) return;
  // bring the carpark into the visible part of the map only when it is off screen or under the sheet
  const pt = map.project([c.lng, c.lat]), pad = sheetPad();
  if (pt.x < 40 || pt.x > innerWidth - 40 || pt.y < pad.top + 30 || pt.y > innerHeight - pad.bottom - 10) map.easeTo({ center: [c.lng, c.lat], padding: pad, duration: 700 });
}
let swipeTimer = 0;
$('cards').addEventListener('scroll', () => {
  clearTimeout(swipeTimer);
  swipeTimer = setTimeout(() => {
    const box = $('cards'), mid = box.scrollLeft + box.clientWidth / 2;
    let near = null, gap = Infinity;
    box.querySelectorAll('.card').forEach(n => { const d = Math.abs(n.offsetLeft + n.offsetWidth / 2 - mid); if (d < gap) { gap = d; near = n; } });
    const c = near && results.find(x => x.id === near.dataset.id);
    if (c && (!focused || focused.id !== c.id)) focus(c, true);
  }, 140);
}, { passive: true });
$('cards').addEventListener('click', e => {
  if (e.target.closest('[data-retry]')) return loadCarparks();
  const n = e.target.closest('.card'); if (!n) return;
  const c = results.find(x => x.id === n.dataset.id); if (c) openDetail(c);
});
const isOpen = () => body.classList.contains(body.classList.contains('detail') ? 'dfull' : 'list');
function setList(open) {
  body.classList.toggle(body.classList.contains('detail') ? 'dfull' : 'list', open);
  $('grab').setAttribute('aria-label', open ? 'Show less' : 'Show more');
  requestAnimationFrame(() => { syncSheet(); if (current) map.easeTo({ padding: sheetPad(), duration: 500 }); if (!open && focused && !picked) focus(focused, false, true); });
}
$('more').onclick = () => setList(true);
let grabY = null;
$('grab').addEventListener('pointerdown', e => { grabY = e.clientY; $('grab').setPointerCapture(e.pointerId); });
$('grab').addEventListener('pointerup', e => {
  if (grabY == null) return;
  const dy = e.clientY - grabY; grabY = null;
  setList(dy < -20 ? true : dy > 20 ? false : !isOpen());   // drag up / down, or tap to flip
});

$('ctl').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.stay) { stay = +b.dataset.stay; store.set('toy.stay', stay); return loadCarparks(); }
  if (b.dataset.sort) sortBy = b.dataset.sort;
  if (b.dataset.f === 'free') onlyFree = !onlyFree;
  if (b.dataset.f === 'ev') onlyEv = !onlyEv;
  renderResults();
});
$('list').addEventListener('click', e => {
  if (e.target.closest('#retry')) return loadCarparks();
  const n = e.target.closest('.cp'); if (!n) return;
  const c = results.find(x => x.id === n.dataset.id); if (c) openDetail(c);
});
$('detail').addEventListener('click', e => {
  if (!picked) return;
  if (e.target.closest('#go')) return openNavigate(picked);
  if (e.target.closest('#dmore')) return setList(true);
  if (e.target.closest('#share')) return shareCarpark(picked);
  if (e.target.closest('#star')) {
    const c = picked, had = isSaved(c);
    savedCps = had ? savedCps.filter(s => s.id !== c.id) : [{ id: c.id, name: c.name, lat: c.lat, lng: c.lng }, ...savedCps];
    store.set('toy.savedCarparks', savedCps);
    toast(had ? 'Removed from saved' : 'Saved. Find it under the search bar.');
    openDetail(c, true);
  }
});
$('nav').addEventListener('click', e => {
  const a = e.target.closest('a[data-nav]');
  if (a) { store.set('toy.nav', a.dataset.nav); closeNavigate(); return; }
  if (e.target === $('nav') || e.target.closest('#navClose')) closeNavigate();
});
$('tilt').onclick = () => { flat = !flat; $('tilt').textContent = flat ? '3D view' : 'Flat map';
  map.easeTo({ pitch: flat ? 0 : 56, bearing: flat ? 0 : map.getBearing(), duration: 1000 }); };
// a tap on the map itself steps back: details -> card strip, full list -> card strip
map.on('click', e => {
  if (e.originalEvent && e.originalEvent.target.closest && e.originalEvent.target.closest('.bub, .pin')) return;
  if (body.classList.contains('detail')) closeDetail();
  else if (body.classList.contains('results') && body.classList.contains('list')) setList(false);
});
['mousedown', 'touchstart', 'wheel'].forEach(ev => map.getCanvas().addEventListener(ev, () => { spinning = false; }, { passive: true }));

requestAnimationFrame(() => requestAnimationFrame(() => body.classList.remove('boot')));
map.setPadding(homePad());
map.once('load', openShared);
(function tick() {
  if (spinning && ready && !map.isEasing()) map.setBearing(map.getBearing() + 0.06);
  requestAnimationFrame(tick);
})();
