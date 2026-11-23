// Toy traffic for the beta map: cars that follow the real roads anywhere in Singapore.
//
// The road network is read from the same map tiles as the buildings and grows as tiles load.
// Rules the cars follow:
//  - one-way carriageways are driven in their real direction, in lanes; two-way streets keep left
//  - a car never gets closer than SPACE to the car ahead in its lane
//  - a junction lets one car through at a time; side streets stop and wait, main roads only stop when it is taken
// Only the area around the map centre has cars: ones left behind are moved to the roads now in view.

export function makeTraffic(THREE, scene, TILE_M) {
  const COUNT = 200;                                  // most cars at once
  const SIZE = 2;                                     // times life size, so they read as toys
  const LEN = 4.6 * SIZE, WID = 2 * SIZE;
  const SPACE = LEN + 3.5;                            // centre-to-centre distance kept in a lane
  const STOP = LEN / 2 + 4;                           // where a waiting car sits before a junction
  const CLEAR = LEN / 2 + 3;                          // how far past a junction before it is free again
  const PAUSE = 0.7;                                  // seconds a side-street car waits at the line
  let NEAR = 600, FAR = 800;                          // metres from the map centre where cars are added / removed; follows the zoom
  const PER_CAR = 80;                                 // metres of lane per car: busy, but not a jam
  const WIDTH = { motorway: 15, trunk: 13, primary: 12, secondary: 10, tertiary: 8.5, minor: 7 };
  const MAJOR = { motorway: 1, trunk: 1, primary: 1, secondary: 1 };
  const PAINT = ['#ff6b4a', '#ffd23f', '#3fa7f5', '#ffffff', '#ff8fb1', '#59c9a5', '#8e7cf0',
                 '#ffffff', '#e8edf2', '#39485a', '#d7dde4', '#2f8fe0', '#c0392b', '#f4f6f8'];

  // ---------- road network (metres on the island-wide board) ----------
  const nodes = new Map(), edgeCells = new Map(), links = [], done = new Set();
  const newNode = (x, y, edge) => ({ p: [x, y], segs: [], out: [], in: [], busy: null, busyT: 0, edge });
  // points on a tile border are matched to the neighbouring tile's by nearness (their coordinates differ by rounding)
  function node(x, y, edge) {
    if (edge) {
      const cx = Math.floor(x / 3), cy = Math.floor(y / 3);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
        for (const n of edgeCells.get((cx + i) + ',' + (cy + j)) || []) if (Math.hypot(n.p[0] - x, n.p[1] - y) < 1.6) return n;
      const n = newNode(x, y, true), k = cx + ',' + cy;
      (edgeCells.get(k) || edgeCells.set(k, []).get(k)).push(n);
      return n;
    }
    const k = Math.round(x * 10) + ',' + Math.round(y * 10);
    return nodes.get(k) || nodes.set(k, newNode(x, y, false)).get(k);
  }
  const other = (s, n) => (s.a === n ? s.b : s.a);
  const same = (s, t) => s.w === t.w && s.ow === t.ow && s.major === t.major;
  const through = n => !n.edge && n.segs.length === 2 && same(n.segs[0], n.segs[1]) &&
    (!n.segs[0].ow || (n.segs[0].b === n) !== (n.segs[1].b === n));
  const dir = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

  // the part of a road piece that lies inside the tile, and which ends were cut at the border
  function clip(a, b, x0, y0, x1, y1) {
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1], t0 > 0, t1 < 1];
  }

  function addTile(vt, key, ox, oy) {
    if (done.has(key)) return;
    done.add(key);
    const layer = vt.layers.transportation; if (!layer) return;
    const x0 = ox, x1 = ox + TILE_M, y1 = oy, y0 = oy - TILE_M, fresh = new Set(), mine = new Set();
    const onEdge = p => p[0] - x0 < 0.02 || x1 - p[0] < 0.02 || p[1] - y0 < 0.02 || y1 - p[1] < 0.02;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i), pr = f.properties, w = WIDTH[pr.class];
      if (!w || f.type !== 2 || pr.brunnel === 'tunnel') continue;
      for (const line of f.loadGeometry()) {
        let pts = line.map(q => [ox + q.x / layer.extent * TILE_M, oy - q.y / layer.extent * TILE_M]);
        if (pr.oneway === -1) pts = pts.reverse();
        for (let j = 1; j < pts.length; j++) {
          const c = clip(pts[j - 1], pts[j], x0, y0, x1, y1);
          if (!c || Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) < 0.05) continue;
          const a = node(c[0][0], c[0][1], c[2] || onEdge(c[0])), b = node(c[1][0], c[1][1], c[3] || onEdge(c[1]));
          if (a === b || a.segs.some(s => s.a === b || s.b === b)) continue;
          const s = { a, b, w, ow: pr.oneway ? 1 : 0, major: !!MAJOR[pr.class] };
          a.segs.push(s); b.segs.push(s); mine.add(s); fresh.add(a); fresh.add(b);
        }
      }
    }
    // chains of road between junctions (or tile borders) become links that cars drive along
    for (const n of fresh) {
      if (through(n)) continue;
      for (const first of n.segs) {
        if (!mine.has(first) || (first.ow && first.a !== n)) continue;
        const pts = [n.p];
        let seg = first, cur = other(first, n), guard = 0;
        while (through(cur) && cur !== n && guard++ < 5000) { pts.push(cur.p); seg = cur.segs[0] === seg ? cur.segs[1] : cur.segs[0]; cur = other(seg, cur); }
        pts.push(cur.p);
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const len = cum[cum.length - 1];
        if (len < 0.5) continue;
        const nl = first.ow ? Math.max(1, Math.min(3, Math.floor(first.w / (WID + 0.6)))) : 1;
        const mid = pts[pts.length >> 1];
        const link = { from: n, to: cur, pts, cum, len, w: first.w, major: first.major, nl, mid,
          lanes: Array.from({ length: nl }, () => []),
          // sideways position of each lane, positive = left of travel
          off: Array.from({ length: nl }, (_, i) => first.ow ? ((nl - 1) / 2 - i) * (first.w / nl) : Math.max(first.w / 4, WID / 2 + 0.1)),
          h0: dir(pts[0], pts[1]), h1: dir(pts[pts.length - 2], pts[pts.length - 1]), a: first, z: seg };
        links.push(link); n.out.push(link); cur.in.push(link);
      }
    }
    nearAt = -1e9;                                    // new roads: look again for places to put cars
  }
  const reverse = (l, m) => l.from === m.to && l.to === m.from && l.a === m.z;   // same street, other way
  const nextsOf = l => l.to.out.filter(m => !reverse(m, l));
  const isJunction = n => n.segs.length >= 3;

  // ---------- cars ----------
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const any = list => list[Math.floor(Math.random() * list.length)];
  const entryRoom = (link, lane) => { const q = link.lanes[lane], c = q[q.length - 1]; return c ? c.s - SPACE : Infinity; };
  const bestLane = link => {
    let best = 0, score = -Infinity;
    for (let i = 0; i < link.nl; i++) { const s = Math.min(entryRoom(link, i), 200) + Math.random() * 20; if (s > score) { score = s; best = i; } }
    return best;
  };
  const pick = (from, opts) => Math.random() < 0.7
    ? opts.reduce((a, b) => Math.abs(wrap(a.h0 - from.h1)) <= Math.abs(wrap(b.h0 - from.h1)) ? a : b)   // mostly straight on
    : any(opts);
  const choose = car => {
    const l = car.link, opts = nextsOf(l);
    car.after = null;
    if (!opts.length) { car.next = null; return; }
    car.next = pick(l, opts);
    car.nextLane = isJunction(l.to) ? bestLane(car.next) : Math.min(car.lane, car.next.nl - 1);
  };
  const segAt = (link, s) => { let i = 1; while (i < link.cum.length - 1 && link.cum[i] < s) i++; return i; };
  const release = car => { for (const n of car.holds) if (n.busy === car) n.busy = null; car.holds = []; };

  const cars = [], pending = [];
  for (let i = 0; i < COUNT; i++) pending.push({ v: 0, v0: 7 + Math.random() * 4, paint: PAINT[i % PAINT.length], holds: [] });
  let near = [], nearLen = 0, nearAt = -1e9, nearX = 1e9, nearY = 1e9, nearR = 0;

  function spawn(car) {
    for (let tries = 0; tries < 6; tries++) {
      const link = any(near), lane = Math.floor(Math.random() * link.nl), q = link.lanes[lane];
      const s = Math.random() * Math.max(0, link.len - STOP - 2);
      if (!q.every(c => Math.abs(c.s - s) > SPACE + 2)) continue;
      const i = segAt(link, s);
      Object.assign(car, { link, lane, s, next: null, after: null, wait: 0, age: 0, v: car.v0 * 0.6, holds: [],
        head: dir(link.pts[i - 1], link.pts[i]), off: link.off[lane] });
      let at = 0; while (at < q.length && q[at].s > s) at++;      // lanes are kept front car first
      q.splice(at, 0, car);
      return true;
    }
    return false;
  }
  const remove = car => { const q = car.link.lanes[car.lane], i = q.indexOf(car); if (i >= 0) q.splice(i, 1); release(car); };

  // try to take the junction ahead (and the next one too, when the street between them is too short to wait on)
  const takeJunction = car => {
    const J = car.link.to, next = car.next;
    if (J.busy || entryRoom(next, car.nextLane) < 1) return false;
    const hold = [J], after = nextsOf(next);
    if (next.len < STOP + CLEAR + 2 && isJunction(next.to) && after.length) {
      const K = next.to;
      if (K.busy || next.lanes[car.nextLane].length) return false;
      const link = pick(next, after), lane = bestLane(link);
      if (entryRoom(link, lane) < 1) return false;
      car.after = { link, lane };
      hold.push(K);
    }
    for (const n of hold) { n.busy = car; n.busyT = 0; car.holds.push(n); }
    return true;
  };

  const step = (car, dt) => {
    const link = car.link, q = link.lanes[car.lane], idx = q.indexOf(car);
    const leader = idx > 0 ? q[idx - 1] : null;
    let room, gone = false;
    if (leader) room = leader.s - car.s - SPACE;
    else {
      if (!car.next) choose(car);
      if (!car.next) room = Infinity;                 // road ends or leaves the loaded map
      else {
        const J = link.to, toEnd = link.len - car.s;
        if (isJunction(J) && !car.holds.includes(J)) {
          room = toEnd - Math.min(STOP, link.len * 0.5);
          const stopped = room < 0.6 && car.v < 0.5;
          if (stopped) car.wait += dt;
          if ((link.major ? room < 22 : stopped && car.wait >= PAUSE) && takeJunction(car)) room = Infinity;
          else if (car.wait > 7) { choose(car); car.wait = 3; }
        } else room = toEnd + entryRoom(car.next, car.nextLane);
      }
    }
    const want = Math.min(car.v0, Math.max(0, room) * 1.1);
    car.v += Math.max(-16 * dt, Math.min(5 * dt, want - car.v));
    if (room <= 0) car.v = 0;
    car.s += Math.min(car.v * dt, Math.max(0, room));
    car.age += dt;

    for (let i = car.holds.length - 1; i >= 0; i--) {   // a junction is free again once the car is clear of it
      const n = car.holds[i];
      if (link.from === n && car.s > Math.min(CLEAR, link.len * 0.5)) { if (n.busy === car) n.busy = null; car.holds.splice(i, 1); }
    }
    if (car.s >= link.len) {
      q.splice(idx, 1);
      for (let i = car.holds.length - 1; i >= 0; i--) if (link.from === car.holds[i]) { if (car.holds[i].busy === car) car.holds[i].busy = null; car.holds.splice(i, 1); }
      if (!car.next) { release(car); gone = true; }
      else {
        car.s -= link.len; car.link = car.next; car.lane = car.nextLane; car.wait = 0;
        car.link.lanes[car.lane].push(car);
        if (car.after) { car.next = car.after.link; car.nextLane = car.after.lane; car.after = null; } else car.next = null;
      }
    }
    return gone;
  };

  // ---------- drawing: one car shape, drawn once per car ----------
  const many = geo => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), COUNT);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; };
  const body = many(new THREE.BoxGeometry(4.2, 1.9, 0.95).translate(0, 0, 0.78));
  const cabin = many(new THREE.BoxGeometry(2.2, 1.7, 0.7).translate(-0.25, 0, 1.6));
  scene.add(body, cabin);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), tint = new THREE.Color();

  function frame(dt, cx, cy, zoom) {
    const now = performance.now();
    // keep the cars where you can see them: a tight circle when zoomed in, wider when zoomed out
    NEAR = Math.max(330, Math.min(950, 380 * 2 ** (16.5 - zoom))); FAR = NEAR * 1.3;
    // which roads are near the view (looked up again after moving, and once a second)
    if (now - nearAt > 1000 || Math.hypot(cx - nearX, cy - nearY) > 150 || Math.abs(NEAR - nearR) > 40) {
      nearAt = now; nearX = cx; nearY = cy; nearR = NEAR; nearLen = 0; near = [];
      for (const l of links) if (l.len > SPACE * 1.5 && Math.hypot(l.mid[0] - cx, l.mid[1] - cy) < NEAR) { near.push(l); nearLen += l.len * l.nl; }
    }
    if (dt > 0) {
      for (const n of nodes.values()) if (n.busy && (n.busyT += dt) > 12) n.busy = null;      // safety net for a stuck junction
      for (const list of edgeCells.values()) for (const n of list) if (n.busy && (n.busyT += dt) > 12) n.busy = null;
      for (let i = cars.length - 1; i >= 0; i--) {
        const car = cars[i];
        let gone = step(car, dt);
        if (!gone && car.x !== undefined && Math.hypot(car.x - cx, car.y - cy) > FAR) { remove(car); gone = true; }   // left behind
        if (gone) { cars.splice(i, 1); pending.push(car); }
      }
      const target = Math.min(COUNT, Math.floor(nearLen / PER_CAR));
      for (let n = 0; n < 6 && near.length && pending.length && cars.length < target; n++) {
        const car = pending.pop();
        if (spawn(car)) cars.push(car); else { pending.push(car); break; }
      }
    }
    const ease = Math.min(1, dt * 5);
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i], link = car.link, j = segAt(link, car.s), a = link.pts[j - 1], b = link.pts[j];
      const k = (car.s - link.cum[j - 1]) / ((link.cum[j] - link.cum[j - 1]) || 1);
      car.head += wrap(dir(a, b) - car.head) * ease;
      car.off += (link.off[car.lane] - car.off) * Math.min(1, dt * 3);
      car.x = a[0] + (b[0] - a[0]) * k - Math.sin(car.head) * car.off;
      car.y = a[1] + (b[1] - a[1]) * k + Math.cos(car.head) * car.off;
      // grow in when added, shrink away where the road ends, so cars do not pop
      let z = Math.min(1, 0.15 + car.age / 0.5);
      if (!car.next && !nextsOf(link).length) z = Math.min(z, 0.15 + (link.len - car.s) / 14);
      z = Math.max(0.15, z) * SIZE;
      M.compose(P.set(car.x, car.y, 0), Q.setFromAxisAngle(Z, car.head), S.set(z, z, z));
      body.setMatrixAt(i, M); cabin.setMatrixAt(i, M);
      body.setColorAt(i, tint.set(car.paint)); cabin.setColorAt(i, tint.set(car.paint === '#39485a' ? '#8fa3b8' : '#dcecf9'));
    }
    for (const m of [body, cabin]) { m.count = cars.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    return cars.length;
  }

  return { addTile, frame, cars, links, stats: () => ({ cars: cars.length, links: links.length, near: near.length, nearLen: Math.round(nearLen) }) };
}
