// P7.7 part A: code-made building shapes per type and tier (cine/stage.js style: a box body, window bands, a roof).
// No models yet: CC0 packs through Data/art/models.json come later with this as the fallback.
const THREE = window.THREE;
export const FLOOR_M = 3.5; // same as cine/stage.js FLOOR_M (Data/art/models.json floorHeightM)

// Body colors by type id (Data/buildings.json); anything unlisted gets the default.
const BODY = { 1: 0xd9b48f, 2: 0xb9c4cf, 3: 0xc9a27e, 4: 0x9fb7c9, 5: 0xcfc3a8, 6: 0xa8b5a0, 7: 0xd6c2a8, 8: 0xb0a8c8, 9: 0xc8b0a0, 10: 0x9aa8b8 };
const FLAT = { 12: 0x5d6168, 14: 0x44474d, 18: 0x55585e }; // lots, drives and driveways lie flat
const TIER_TINT = [0.82, 1.0, 1.12]; // low, basic, premium: premium reads brighter
const TIER_ROOF = [0x6b5a4a, 0x55606b, 0x2f3a45];

export function isFlat(type) { return Object.prototype.hasOwnProperty.call(FLAT, type); }

function tint(hex, k) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
  return c;
}

// b: a site view building; cell: meters per cell; origin(i, j) gives the north-west corner of a site cell in meters.
export function makeBuilding(b, cell, origin) {
  const [i0, j0, i1, j1] = [Math.min(b.rect[0], b.rect[2]), Math.min(b.rect[1], b.rect[3]), Math.max(b.rect[0], b.rect[2]), Math.max(b.rect[1], b.rect[3])];
  const w = (i1 - i0 + 1) * cell, d = (j1 - j0 + 1) * cell;
  const nw = origin(i0, j0);
  const g = new THREE.Group();
  g.name = 'building:' + b.id;
  g.userData.buildingId = b.id;
  const tier = Math.max(0, Math.min(2, b.tier | 0));
  if (isFlat(b.type)) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.15, d * 0.98), new THREE.MeshLambertMaterial({ color: FLAT[b.type] }));
    m.position.y = 0.08; g.add(m);
  } else {
    const floors = Math.max(1, b.floors | 0), h = floors * FLOOR_M;
    const inset = 0.92; // a little yard round every footprint so neighbours read apart
    const body = new THREE.Mesh(new THREE.BoxGeometry(w * inset, h, d * inset),
      new THREE.MeshLambertMaterial({ color: tint(BODY[b.type] || 0xc8c0b4, TIER_TINT[tier]) }));
    body.position.y = h / 2; g.add(body);
    const band = new THREE.MeshLambertMaterial({ color: 0x33414f });
    for (let f = 0; f < floors; f++) { // one window band per floor
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * inset + 0.1, FLOOR_M * 0.35, d * inset + 0.1), band);
      m.position.y = f * FLOOR_M + FLOOR_M * 0.55; g.add(m);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * inset + 0.6, 0.6, d * inset + 0.6), new THREE.MeshLambertMaterial({ color: TIER_ROOF[tier] }));
    roof.position.y = h + 0.3; g.add(roof);
    if (b.state === 'build' || b.state === 'review') body.material.transparent = true, body.material.opacity = 0.55;
  }
  g.position.set(nw.x + w / 2, 0, nw.z + d / 2);
  return g;
}
