// The toy 3D look for all of Singapore, drawn by three.js inside the MapLibre map.
//
// Nothing is pre-built: the page reads the same map tiles the flat map uses (OpenFreeMap, zoom 14),
// and turns each tile's building outlines, parks and roads into toy blocks and trees as you move.
// MapLibre still owns the camera, gestures, flat ground and labels. Loaded after beta.js; uses its `map`.
import * as THREE from './vendor/three.module.min.js';
import { Pbf, VectorTile } from './vendor/vt.js';

const TILE_Z = 14;            // the most detailed zoom these tiles are published at
const SHOW_FROM = 14.7;       // below this zoom the flat map's simple blocks are shown instead
const REACH = 1150;           // metres around the map centre that get the toy treatment
const KEEP = 14;              // tiles kept in memory before the least recently seen are dropped
const UP = 1.3, FLOOR = 3 * UP;   // toy look: everything a little taller than life
const TREES_PER_TILE = 9000;

// one metre grid for the whole island, centred on Singapore
const ORIGIN = maplibregl.MercatorCoordinate.fromLngLat([103.82, 1.35], 0);
const UNIT = ORIGIN.meterInMercatorCoordinateUnits();
const toBoard = new THREE.Matrix4().makeTranslation(ORIGIN.x, ORIGIN.y, 0).scale(new THREE.Vector3(UNIT, -UNIT, UNIT));
const N = 2 ** TILE_Z, TILE_M = 1 / N / UNIT;
const metresOf = ll => { const m = maplibregl.MercatorCoordinate.fromLngLat(ll, 0); return [(m.x - ORIGIN.x) / UNIT, -(m.y - ORIGIN.y) / UNIT]; };

// ---------- shapes ----------
const tmp = new THREE.Color();
const area = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], n = r[(i + 1) % r.length]; a += p[0] * n[1] - n[0] * p[1]; } return a / 2; };
const inside = (x, y, r) => {
  let hit = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) hit = !hit;
  return hit;
};
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

class Builder {            // collects triangles for one merged mesh
  constructor() { this.pos = []; this.nor = []; this.col = []; this.kind = []; }
  v(x, y, z, nx, ny, nz, c, k) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); tmp.set(c); this.col.push(tmp.r, tmp.g, tmp.b); this.kind.push(k); }
  walls(ring, b, h, c, k, flip) {
    for (let i = 0; i < ring.length; i++) {
      const p = flip ? ring[(i + 1) % ring.length] : ring[i], n = flip ? ring[i] : ring[(i + 1) % ring.length];
      const dx = n[0] - p[0], dy = n[1] - p[1], len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
      this.v(p[0], p[1], b, nx, ny, 0, c, k); this.v(n[0], n[1], b, nx, ny, 0, c, k); this.v(n[0], n[1], h, nx, ny, 0, c, k);
      this.v(p[0], p[1], b, nx, ny, 0, c, k); this.v(n[0], n[1], h, nx, ny, 0, c, k); this.v(p[0], p[1], h, nx, ny, 0, c, k);
    }
  }
  // upright walls and a flat lid; k: 0 plain, 1 striped floors (painted by the shader)
  prism(outer, holes, b, h, c, k = 0, lid = true) {
    this.walls(outer, b, h, c, k, false);
    for (const hole of holes) this.walls(hole, b, h, c, k, false);
    if (!lid) return;
    const all = [outer, ...holes].flat();
    const tris = THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(p[0], p[1])), holes.map(hl => hl.map(p => new THREE.Vector2(p[0], p[1]))));
    for (const t of tris) for (const i of t) this.v(all[i][0], all[i][1], h, 0, 0, 1, c, 0);
  }
  hip(ring, z, rise, c) {   // a pitched roof rising to a point above the middle
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], n = ring[(i + 1) % ring.length];
      const nm = new THREE.Vector3(n[0] - p[0], n[1] - p[1], 0).cross(new THREE.Vector3(cx - p[0], cy - p[1], rise)).normalize();
      this.v(p[0], p[1], z, nm.x, nm.y, nm.z, c, 0); this.v(n[0], n[1], z, nm.x, nm.y, nm.z, c, 0); this.v(cx, cy, z + rise, nm.x, nm.y, nm.z, c, 0);
    }
  }
  mesh(material) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('kind', new THREE.Float32BufferAttribute(this.kind, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
}

const blocksMat = new THREE.MeshLambertMaterial({ vertexColors: true });
blocksMat.onBeforeCompile = sh => {   // floors are painted by height, so a 40-storey tower is one box
  sh.uniforms.uFloor = { value: FLOOR };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float kind;\nvarying float vKind;\nvarying float vUp;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKind = kind;\nvUp = position.z;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uFloor;\nvarying float vKind;\nvarying float vUp;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      if (vKind > 0.5) {
        float fl = vUp / uFloor;
        if (fl < 1.0) diffuseColor.rgb = vec3(0.604, 0.521, 0.396);                 // ground floor
        else if (fract(fl) < 0.68) diffuseColor.rgb = vec3(1.0, 0.939, 0.823);      // cream wall; the rest keeps the stripe colour
      }`);
};

// one tree = trunk + two crowns in a single shape, drawn thousands of times
function treeGeometry() {
  const parts = [
    [new THREE.CylinderGeometry(0.32, 0.5, 3.4, 5).rotateX(Math.PI / 2).translate(0, 0, 1.7), '#7a5236'],
    [new THREE.IcosahedronGeometry(1, 0).scale(3.1, 3.1, 2.5).translate(0, 0, 4.7), '#ffffff'],
    [new THREE.IcosahedronGeometry(1, 0).rotateZ(0.5).scale(2.1, 2.1, 1.9).translate(0, 0, 7.3), '#eaffd9'],
  ];
  const pos = [], nor = [], col = [];
  for (const [g0, c] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); tmp.set(c);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(tmp.r, tmp.g, tmp.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const TREE = treeGeometry();
const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const LEAF = ['#58b85c', '#6cc566', '#4aa856', '#7dcf70', '#63c06a'];

const TOWER = [['#ff8f6b', '#e9694a'], ['#4fc3b0', '#2f9f8d'], ['#ffc857', '#e2a52e'], ['#6fb1f5', '#4a8fd8'], ['#b79cf2', '#9478d6'], ['#f78fb3', '#da6c93']];
const TALL = [['#7fb4e6', '#4f86c2'], ['#8fd0d6', '#4fa3ad'], ['#a9b8cc', '#71839b'], ['#9db7f0', '#5f7fd0']];
const HOUSE_ROOF = ['#e0755a', '#c9634b', '#d98a4e', '#8b6f5e'];
const LOW = [['#eef2f6', '#9fb0c2'], ['#f3ead9', '#c4a987'], ['#e6eef7', '#7f9fc4']];
const ROAD_W = { motorway: 15, trunk: 13, primary: 12, secondary: 10, tertiary: 8.5, minor: 7, service: 4.5 };

// ---------- one map tile -> a group of meshes ----------
function buildTile(vt, tx, ty) {
  const group = new THREE.Group();
  const ox = (tx / N - ORIGIN.x) / UNIT, oy = -(ty / N - ORIGIN.y) / UNIT;      // the tile's north-west corner, in board metres
  group.position.set(ox, oy, 0);
  const rand = rng(tx * 73856093 ^ ty * 19349663);
  const pt = (p, ext) => [p.x / ext * TILE_M, -p.y / ext * TILE_M];
  const rings = (f, ext) => f.loadGeometry().map(r => { const a = r.map(p => pt(p, ext)); a.pop(); return a; }).filter(r => r.length >= 3);
  const each = (name, fn) => { const l = vt.layers[name]; if (l) for (let i = 0; i < l.length; i++) fn(l.feature(i), l.extent); };

  // buildings (the tiles group several outlines into one feature, so sort rings into shapes and their holes)
  const blocks = new Builder(), foot = [];
  each('building', (f, ext) => {
    const p = f.properties;
    if (p.hide_3d) return;
    const h = Math.max(3, p.render_height || 5) * UP, base = Math.max(0, p.render_min_height || 0) * UP;
    let shape = null; const shapes = [];
    for (const r of rings(f, ext)) {
      const a = area(r);
      // with north up, the tiles wind outlines clockwise and holes the other way; the builder wants the opposite
      if (a < 0) { shape = { outer: r.reverse(), holes: [], a: -a }; shapes.push(shape); }
      else if (shape) shape.holes.push(r.reverse());
    }
    for (const s of shapes) {
      if (s.a < 12) continue;
      const cx = s.outer.reduce((t, q) => t + q[0], 0) / s.outer.length, cy = s.outer.reduce((t, q) => t + q[1], 0) / s.outer.length;
      if (cx < 0 || cx >= TILE_M || cy > 0 || cy <= -TILE_M) continue;               // the neighbouring tile draws it
      foot.push(s.outer);
      const gx = Math.floor((ox + cx) / 170), gy = Math.floor((oy + cy) / 170), key = Math.abs(gx * 7 + gy * 13 + Math.round(s.a));
      if (base > 0.5) { const [wall, roof] = LOW[key % LOW.length]; blocks.prism(s.outer, s.holes, base, h, wall, 0, false); blocks.prism(s.outer, s.holes, h, h + 0.8, roof); }
      else if (h >= 20 && s.a >= 180) {
        const [band, roof] = h > 95 ? TALL[key % TALL.length] : TOWER[Math.abs(gx * 2 + gy) % TOWER.length];   // neighbours share a paint scheme
        blocks.prism(s.outer, s.holes, 0, h, band, 1, false); blocks.prism(s.outer, s.holes, h, h + 1.4, roof);
      } else if (s.a < 260 && h <= 14 && !s.holes.length) { blocks.prism(s.outer, [], 0, h, '#fff3df', 0, false); blocks.hip(s.outer, h, 2.6, HOUSE_ROOF[key % HOUSE_ROOF.length]); }
      else { const [wall, roof] = LOW[key % LOW.length]; blocks.prism(s.outer, s.holes, 0, h, wall, 0, false); blocks.prism(s.outer, s.holes, h, h + 1, roof); }
    }
  });
  const bm = blocks.mesh(blocksMat);
  if (bm) group.add(bm);

  // where trees may not stand: building outlines and road surfaces, looked up through a coarse grid
  const CELL = 40, grid = new Map();
  const cell = (x, y) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL);
  const put = (x0, y0, x1, y1, item) => { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) { const k = i + ',' + j; (grid.get(k) || grid.set(k, []).get(k)).push(item); } };
  for (const r of foot) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of r) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } put(x0 - 2, y0 - 2, x1 + 2, y1 + 2, { ring: r }); }
  const roads = [];
  each('transportation', (f, ext) => {
    const p = f.properties, w = ROAD_W[p.class];
    if (!w || f.type !== 2 || p.brunnel === 'tunnel') return;
    for (const line of f.loadGeometry()) {
      const pts = line.map(q => pt(q, ext));
      roads.push({ pts, w, street: p.class !== 'service' && p.class !== 'motorway' && !p.brunnel });
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], pad = w / 2 + 2; put(Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad, { a, b, r: w / 2 + 1.6 }); }
    }
  });
  const blocked = (x, y) => {
    for (const it of grid.get(cell(x, y)) || []) {
      if (it.ring) { if (inside(x, y, it.ring)) return true; continue; }
      const dx = it.b[0] - it.a[0], dy = it.b[1] - it.a[1], t = Math.max(0, Math.min(1, ((x - it.a[0]) * dx + (y - it.a[1]) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(x - it.a[0] - dx * t, y - it.a[1] - dy * t) < it.r) return true;
    }
    return false;
  };

  // sea, rivers, reservoirs and pools: no trees there (a point is in the water if an odd number of its rings surround it)
  const waters = [];
  each('water', (f, ext) => {
    if (f.type !== 3) return;
    const rs = rings(f, ext); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rs) for (const p of r) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    waters.push({ rs, x0, y0, x1, y1 });
  });
  const wet = (x, y) => {
    for (const w of waters) {
      if (x < w.x0 || x > w.x1 || y < w.y0 || y > w.y1) continue;
      let n = 0; for (const r of w.rs) if (inside(x, y, r)) n++;
      if (n % 2) return true;
    }
    return false;
  };

  // trees: along the streets, and scattered through parks, grass and woods ("city in a garden")
  const trees = [], tgrid = new Map();
  const plant = (x, y, s, gap) => {
    if (trees.length >= TREES_PER_TILE || x < 0 || x >= TILE_M || y > 0 || y <= -TILE_M || blocked(x, y) || wet(x, y)) return;
    const gx = Math.floor(x / 8), gy = Math.floor(y / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of tgrid.get((gx + i) + ',' + (gy + j)) || []) if (Math.hypot(x - q[0], y - q[1]) < gap) return;
    const k = gx + ',' + gy; (tgrid.get(k) || tgrid.set(k, []).get(k)).push([x, y]);
    trees.push([x, y, s]);
  };
  for (const r of roads) {
    if (!r.street) continue;
    let carry = 2 + rand() * 7;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, off = r.w / 2 + 3.2;
      let d = carry;
      for (; d < L; d += 9) for (const s of [1, -1]) plant(a[0] + ux * d - uy * s * off, a[1] + uy * d + ux * s * off, 0.9 + rand() * 0.4, 5);
      carry = d - L;
    }
  }
  const scatter = (name, pick) => each(name, (f, ext) => {
    const per = pick(f.properties); if (!per || f.type !== 3) return;
    for (const r of rings(f, ext)) {
      const a = Math.abs(area(r)); if (a < 60) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of r) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      for (let n = Math.min(2500, Math.round((x1 - x0) * (y1 - y0) / per)); n > 0; n--) {
        const x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0);
        if (inside(x, y, r)) plant(x, y, per < 60 ? 0.9 + rand() * 0.7 : 0.8 + rand() * 0.4, per < 60 ? 4.6 : 6.5);
      }
    }
  });
  scatter('landcover', p => p.class === 'wood' ? 46 : p.class === 'grass' && p.subclass !== 'golf_course' && p.subclass !== 'grassland' ? 150 : 0);
  scatter('park', () => 170);
  for (let n = 5200; n > 0; n--) plant(rand() * TILE_M, -rand() * TILE_M, 0.75 + rand() * 0.45, 9);     // greenery between the blocks

  // trees are drawn in 4 x 4 patches so the ones off screen cost nothing
  const PATCH = TILE_M / 4, patches = new Map();
  for (const t of trees) { const k = Math.floor(t[0] / PATCH) + ',' + Math.floor(-t[1] / PATCH); (patches.get(k) || patches.set(k, []).get(k)).push(t); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Zax = new THREE.Vector3(0, 0, 1);
  for (const list of patches.values()) {
    const im = new THREE.InstancedMesh(TREE, treeMat, list.length);
    list.forEach(([x, y, s], i) => { im.setMatrixAt(i, M.compose(P.set(x, y, 0), Q.setFromAxisAngle(Zax, x * 0.7), S.set(s, s, s))); im.setColorAt(i, tmp.set(LEAF[(i + (x | 0)) % LEAF.length])); });
    im.castShadow = im.receiveShadow = true; im.userData.trees = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  group.userData = { buildings: foot.length, trees: trees.length };
  return group;
}

// ---------- scene, light, shadows ----------
const scene = new THREE.Scene();
const land = new THREE.Group(); scene.add(land);
// Invisible except where a shadow falls on the map. It floats a metre up: any lower and it flickers against the map's own ground.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), new THREE.ShadowMaterial({ opacity: 0.3, color: '#16324a' }));
ground.position.z = 1; ground.receiveShadow = true; scene.add(ground);
scene.add(new THREE.HemisphereLight('#ffffff', '#d5d9cf', 1.75));
const sun = new THREE.DirectionalLight('#fff1d6', 2.5), SUN_DIR = new THREE.Vector3(-700, -520, 720);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -950, right: 950, top: 950, bottom: -950, near: 10, far: 3200 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);

// ---------- loading tiles as the map moves ----------
const tiles = new Map();      // "x/y" -> { group, seen, state }
let template = null, lastScan = 0;
const stats = { frames: 0, ms: 0, buildMs: 0, built: 0, failed: 0 };
fetch('https://tiles.openfreemap.org/planet').then(r => r.json()).then(j => { template = j.tiles[0]; }).catch(() => { stats.failed++; });

async function load(key, x, y) {
  const rec = { group: null, seen: performance.now(), state: 'loading' };
  tiles.set(key, rec);
  try {
    const res = await fetch(template.replace('{z}', TILE_Z).replace('{x}', x).replace('{y}', y));
    if (!res.ok) throw new Error(res.status);
    const vt = new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())));
    await new Promise(r => setTimeout(r, 0));                 // let a frame through before the heavy part
    const t0 = performance.now();
    rec.group = buildTile(vt, x, y);
    stats.buildMs += performance.now() - t0; stats.built++;
    rec.state = 'ready';
    if (tiles.get(key) === rec) land.add(rec.group);
    map.triggerRepaint();
  } catch { rec.state = 'failed'; stats.failed++; setTimeout(() => { if (tiles.get(key) === rec) tiles.delete(key); }, 8000); }
}
function drop(key) {
  const rec = tiles.get(key); tiles.delete(key);
  if (!rec || !rec.group) return;
  land.remove(rec.group);
  rec.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); });
}
function scan(cx, cy, on) {
  const now = performance.now();
  if (on && template) {
    const x0 = Math.floor((ORIGIN.x + (cx - REACH) * UNIT) * N), x1 = Math.floor((ORIGIN.x + (cx + REACH) * UNIT) * N);
    const y0 = Math.floor((ORIGIN.y - (cy + REACH) * UNIT) * N), y1 = Math.floor((ORIGIN.y - (cy - REACH) * UNIT) * N);
    let loading = 0; for (const r of tiles.values()) if (r.state === 'loading') loading++;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = x + '/' + y, rec = tiles.get(key);
      if (rec) rec.seen = now; else if (loading < 2) { loading++; load(key, x, y); }
    }
  }
  if (tiles.size > KEEP) [...tiles.entries()].filter(([, r]) => r.state !== 'loading').sort((a, b) => a[1].seen - b[1].seen).slice(0, tiles.size - KEEP).forEach(([k]) => drop(k));
}

// ---------- the MapLibre layer ----------
const camera = new THREE.Camera();
let renderer = null;
const layer = {
  id: 'three3d', type: 'custom', renderingMode: '3d',
  onAdd(m, gl) {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
    renderer.autoClear = false;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  },
  render(gl, matrix) {
    const t0 = performance.now(), c = map.getCenter(), [cx, cy] = metresOf([c.lng, c.lat]), on = map.getZoom() >= SHOW_FROM;
    if (t0 - lastScan > 250) { lastScan = t0; scan(cx, cy, on); }
    land.visible = ground.visible = on;
    if (!on) return;
    // the sun and its shadow area follow the view, in 25 m steps so shadow edges do not crawl while panning
    const sx = Math.round(cx / 25) * 25, sy = Math.round(cy / 25) * 25;
    sun.target.position.set(sx, sy, 0); sun.position.set(sx + SUN_DIR.x, sy + SUN_DIR.y, SUN_DIR.z);
    ground.position.set(sx, sy, 1);
    camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(toBoard);
    const cv = map.getCanvas();
    renderer.setViewport(0, 0, cv.width, cv.height);
    renderer.resetState();
    renderer.render(scene, camera);
    stats.frames++; stats.ms += performance.now() - t0;
  },
};
const add = () => { if (!map.getLayer('three3d')) map.addLayer(layer, map.getLayer('place-name') ? 'place-name' : undefined); };
if (map.isStyleLoaded()) add(); else map.once('load', add);
map.on('moveend', () => map.triggerRepaint());
window.toy3d = { stats, tiles, scene, sun, info: () => renderer && renderer.info.render, SHOW_FROM };
