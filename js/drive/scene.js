// P7.9 part C: the graybox drive scene. Roads, lots, landmarks and district rings from /api/city/view as plain boxes.
// window.THREE is the vendored three.min.js (index.html loads it). No game rules here.
const T = () => window.THREE;
const COL = { ground: 0xd9d4c7, road: 0x4a4d55, freeway: 0x8a6a2a, lot: 0xbdb7a8, forSale: 0x1b7f4b, mine: 0x1f5fbf, found: 0xe0a100, landmark: 0x6b6f78, car: 0xc23b22, traffic: 0x8899aa };

export function buildScene(view) {
  const THREE = T();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9d6e3);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8577, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(300, 600, 200); scene.add(sun);
  const [x0, z0, x1, z1] = view.bounds;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 800, z1 - z0 + 800), new THREE.MeshLambertMaterial({ color: COL.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); scene.add(ground);

  const nodes = Object.fromEntries(view.nodes.map((n) => [n.id, n]));
  const roadMat = new THREE.MeshLambertMaterial({ color: COL.road }), fwyMat = new THREE.MeshLambertMaterial({ color: COL.freeway });
  const segments = [];
  for (const r of view.roads) {
    const a = nodes[r.from], b = nodes[r.to]; if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.z - a.z); if (len < 0.1) continue;
    const width = Math.max(1, r.lanes || 1) * 3.5 * (r.oneWay ? 1 : 2) / (r.freeway ? 1 : 1.4);
    const m = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, len + width), r.freeway ? fwyMat : roadMat);
    m.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2); m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    scene.add(m); segments.push({ a, b, width });
  }
  const lots = new Map();
  for (const l of view.lots) {
    const color = l.status === 'for_sale' ? COL.forSale : l.status === 'mine' ? COL.mine : COL.lot;
    const m = new THREE.Mesh(new THREE.BoxGeometry(l.width, 0.6, l.depth), new THREE.MeshLambertMaterial({ color }));
    m.position.set(l.x, 0.3, l.z); scene.add(m); lots.set(l.id, m);
    if (l.status === 'for_sale') addSign(scene, l);
  }
  const lmMat = new THREE.MeshLambertMaterial({ color: COL.landmark });
  for (const k of view.landmarks) { const m = new THREE.Mesh(new THREE.BoxGeometry(14, 30, 14), lmMat); m.position.set(k.x, 15, k.z); scene.add(m); }
  for (const d of view.districts) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(d.radius - 2, d.radius, 64), new THREE.MeshBasicMaterial({ color: 0x9a9384, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(d.x, 0.02, d.z); scene.add(ring);
  }
  return { scene, view, lots, segments, markFound: (lot) => markFound(scene, lots, lot) };
}

function addSign(scene, l) {
  const THREE = T();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  post.position.set(l.x, 1.5, l.z); scene.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 0.2), new THREE.MeshLambertMaterial({ color: COL.found }));
  board.position.set(l.x, 3.6, l.z); scene.add(board);
}

function markFound(scene, lots, lot) {
  const m = lots.get(lot.id); if (m) m.material.color.setHex(COL.forSale);
  addSign(scene, lot);
}

export function carMesh(length, height) {
  const THREE = T();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, height * 0.55, length), new THREE.MeshLambertMaterial({ color: COL.car }));
  body.position.y = height * 0.3; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, height * 0.45, length * 0.5), new THREE.MeshLambertMaterial({ color: 0x7a2517 }));
  cab.position.set(0, height * 0.78, -length * 0.05); g.add(cab);
  return g;
}

/** Closest point on the road network to (x, z): where the car starts and where fast travel drops it. */
export function nearestRoad(segments, x, z) {
  let best = null, bd = Infinity;
  for (const s of segments) {
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, L = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / L));
    const px = s.a.x + dx * t, pz = s.a.z + dz * t, d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; best = { x: px, z: pz, heading: Math.atan2(dx, dz) }; }
  }
  return best || { x, z, heading: 0 };
}

export function trafficLayer(scene) {
  const THREE = T();
  const boxes = new Map(), mat = new THREE.MeshLambertMaterial({ color: COL.traffic });
  return {
    set(cars) {
      const seen = new Set();
      for (const c of cars || []) {
        let m = boxes.get(c.id);
        if (!m) { m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 4.5), mat); scene.add(m); boxes.set(c.id, m); }
        m.position.set(c.x, 0.8, c.z); m.rotation.y = c.heading || 0; seen.add(c.id);
      }
      for (const [id, m] of boxes) if (!seen.has(id)) { scene.remove(m); boxes.delete(id); }
      return boxes.size;
    },
  };
}
