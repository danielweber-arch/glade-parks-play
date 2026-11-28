// N438 (owner direction 2026-11-27 item 2): a low poly player figure built from primitives, no model files.
// Colors and proportions come from Data/ui/creator-look.json (served at data/ui/). Stable API (slot n3 may stand the
// player in the open world with it):
//   makeFigure(THREE, look, palette) -> THREE.Group   look = { body, skin, hair, face } ids; palette = parsed JSON
//   applyLook(group, look, palette)                    updates the same meshes in place (no allocation per hover)
//   loadLook()                                         fetches and parses the palette (null when it cannot)
// The group stands on y = 0 and faces +z. group.userData.height is the drawn height in scene units.
const LOOK_URL = new URL('../../data/ui/creator-look.json', import.meta.url).href;

export async function loadLook(url = LOOK_URL) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; }
}

const val = (entry, fallback) => (entry && entry.value !== undefined ? entry.value : fallback);
const pick = (table, id) => { const t = table || {}; return val(t[id], val(t[Object.keys(t)[0]], null)); };

const HAIR_PARTS = ['cap', 'buzz', 'curly', 'drape', 'braidL', 'braidR', 'bun', 'brim', 'crown'];
const HAIR_SHAPES = {
  cap: ['cap'], buzz: ['buzz'], curly: ['curly'], long: ['cap', 'drape'], braids: ['cap', 'braidL', 'braidR'],
  bun: ['cap', 'bun'], hat: ['brim', 'crown'], none: [],
};

function mat(THREE, color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }); }

export function makeFigure(THREE, look, palette) {
  const p = palette || {};
  const m = {
    skin: mat(THREE, '#c98e66'), hair: mat(THREE, '#3b2a1e'), shirt: mat(THREE, val(p.shirt, '#2f7dd1')),
    pants: mat(THREE, val(p.pants, '#3a3f58')), shoes: mat(THREE, val(p.shoes, '#2b2420')),
    feature: mat(THREE, val(p.featureColor, '#22180f')), white: mat(THREE, '#fbf7f0'), freckle: mat(THREE, '#9a5a3a'),
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
  const half = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const arc = new THREE.TorusGeometry(1, 0.28, 4, 10, Math.PI);
  const ring = new THREE.TorusGeometry(1, 0.18, 4, 12);
  const mk = (geo, material, parent) => { const x = new THREE.Mesh(geo, material); parent.add(x); return x; };

  const g = new THREE.Group();
  g.name = 'gp-figure';
  const parts = {};
  parts.legL = mk(box, m.pants, g); parts.legR = mk(box, m.pants, g);
  parts.shoeL = mk(box, m.shoes, g); parts.shoeR = mk(box, m.shoes, g);
  parts.torso = mk(box, m.shirt, g);
  parts.armL = mk(box, m.shirt, g); parts.armR = mk(box, m.shirt, g);
  parts.handL = mk(ball, m.skin, g); parts.handR = mk(ball, m.skin, g);
  parts.neck = mk(cyl, m.skin, g);
  const head = new THREE.Group(); g.add(head); parts.head = head;
  parts.skull = mk(ball, m.skin, head);
  parts.earL = mk(ball, m.skin, head); parts.earR = mk(ball, m.skin, head);
  parts.nose = mk(box, m.skin, head);
  // Hair: every shape is built once and shown or hidden.
  const hair = {};
  hair.cap = mk(half, m.hair, head);
  hair.buzz = mk(half, m.hair, head);
  hair.curly = new THREE.Group(); head.add(hair.curly);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, up = i % 2 ? 0.55 : 0.85;
    const c = mk(ball, m.hair, hair.curly);
    c.scale.setScalar(0.42);
    c.position.set(Math.cos(a) * 0.82 * Math.cos(up * 0.9), 0.15 + Math.sin(up) * 0.7, Math.sin(a) * 0.82 * Math.cos(up * 0.9) - 0.08);
  }
  hair.drape = mk(box, m.hair, head);
  hair.braidL = mk(cyl, m.hair, head); hair.braidR = mk(cyl, m.hair, head);
  hair.bun = mk(ball, m.hair, head);
  hair.brim = mk(cyl, m.hair, head); hair.crown = mk(cyl, m.hair, head);
  parts.hair = hair;
  // Face: two of each feature, shaped per face id.
  const face = {};
  face.eyeL = mk(ball, m.feature, head); face.eyeR = mk(ball, m.feature, head);
  face.browL = mk(box, m.feature, head); face.browR = mk(box, m.feature, head);
  face.smile = mk(arc, m.feature, head); face.flat = mk(box, m.feature, head); face.grin = mk(box, m.white, head);
  face.glassL = mk(ring, m.feature, head); face.glassR = mk(ring, m.feature, head); face.bridge = mk(box, m.feature, head);
  face.freckles = new THREE.Group(); head.add(face.freckles);
  [[-0.45, -0.12], [-0.33, -0.2], [-0.52, -0.25], [0.45, -0.12], [0.33, -0.2], [0.52, -0.25]].forEach(([x, y]) => {
    const f = mk(ball, m.freckle, face.freckles); f.scale.setScalar(0.04); f.position.set(x, y, 0.86);
  });
  face.beard = mk(half, m.hair, head);
  parts.face = face;
  g.userData = { gpFigure: true, parts, mats: m, look: null, height: 0 };
  layoutFace(parts);
  applyLook(g, look || {}, palette);
  return g;
}

// Fixed placements in head units (the skull is a unit ball scaled by the head radius).
function layoutFace(p) {
  const h = p.hair, f = p.face;
  p.earL.scale.set(0.16, 0.24, 0.12); p.earL.position.set(-0.98, 0, 0);
  p.earR.scale.set(0.16, 0.24, 0.12); p.earR.position.set(0.98, 0, 0);
  p.nose.scale.set(0.14, 0.2, 0.2); p.nose.position.set(0, -0.08, 0.95);
  h.cap.scale.set(1.08, 1.0, 1.1); h.cap.position.set(0, 0.06, -0.03);
  h.buzz.scale.set(1.03, 0.92, 1.04); h.buzz.position.set(0, 0.04, -0.01);
  h.drape.scale.set(1.9, 1.6, 0.35); h.drape.position.set(0, -0.45, -0.75);
  h.braidL.scale.set(0.16, 1.5, 0.16); h.braidL.position.set(-0.75, -0.8, -0.35);
  h.braidR.scale.set(0.16, 1.5, 0.16); h.braidR.position.set(0.75, -0.8, -0.35);
  h.bun.scale.setScalar(0.42); h.bun.position.set(0, 1.0, -0.45);
  h.brim.scale.set(1.9, 0.08, 1.9); h.brim.position.set(0, 0.55, 0);
  h.crown.scale.set(0.95, 0.75, 0.95); h.crown.position.set(0, 0.95, 0);
  f.eyeL.position.set(-0.34, 0.12, 0.88); f.eyeR.position.set(0.34, 0.12, 0.88);
  f.browL.position.set(-0.34, 0.36, 0.9); f.browR.position.set(0.34, 0.36, 0.9);
  f.smile.scale.setScalar(0.24); f.smile.rotation.z = Math.PI; f.smile.position.set(0, -0.32, 0.9);
  f.flat.scale.set(0.38, 0.06, 0.06); f.flat.position.set(0, -0.4, 0.92);
  f.grin.scale.set(0.5, 0.16, 0.06); f.grin.position.set(0, -0.4, 0.9);
  f.glassL.scale.setScalar(0.24); f.glassL.position.set(-0.34, 0.12, 0.98);
  f.glassR.scale.setScalar(0.24); f.glassR.position.set(0.34, 0.12, 0.98);
  f.bridge.scale.set(0.2, 0.05, 0.05); f.bridge.position.set(0, 0.14, 1.0);
  f.beard.scale.set(1.0, 0.75, 1.02); f.beard.rotation.x = Math.PI; f.beard.position.set(0, -0.12, 0.02);
}

export function applyLook(group, look, palette) {
  const d = group && group.userData;
  if (!d || !d.gpFigure) return group;
  const p = palette || {}, l = look || {}, P = d.parts, m = d.mats;
  const body = pick(p.body, l.body) || { height: 1, width: 1 };
  const skin = pick(p.skin, l.skin) || '#c98e66';
  const hair = pick(p.hair, l.hair) || { color: '#3b2a1e', shape: 'cap' };
  const face = pick(p.face, l.face) || { eyes: 'dot', brows: 'flat', mouth: 'smile', extra: 'none' };
  const H = Number(body.height) || 1, W = Number(body.width) || 1;
  m.skin.color.set(skin);
  m.hair.color.set(hair.color || '#3b2a1e');
  // Proportions: legs and torso stretch with height, torso and shoulders widen with width.
  const legH = 0.8 * H, torsoH = 0.62 * H, torsoW = 0.44 * W, legW = 0.15 * Math.max(0.9, W * 0.95);
  [[P.legL, -1], [P.legR, 1]].forEach(([leg, s]) => { leg.scale.set(legW, legH, 0.17); leg.position.set(s * torsoW * 0.24, legH / 2 + 0.06, 0); });
  [[P.shoeL, -1], [P.shoeR, 1]].forEach(([sh, s]) => { sh.scale.set(legW + 0.02, 0.08, 0.26); sh.position.set(s * torsoW * 0.24, 0.04, 0.04); });
  const hip = legH + 0.06;
  P.torso.scale.set(torsoW, torsoH, 0.24 * Math.max(1, W * 0.9)); P.torso.position.set(0, hip + torsoH / 2, 0);
  const armH = torsoH * 0.95, shoulder = hip + torsoH;
  [[P.armL, P.handL, -1], [P.armR, P.handR, 1]].forEach(([arm, hand, s]) => {
    const x = s * (torsoW / 2 + 0.065);
    arm.scale.set(0.11 * Math.max(0.9, W), armH, 0.13); arm.position.set(x, shoulder - armH / 2, 0);
    hand.scale.setScalar(0.065); hand.position.set(x, shoulder - armH - 0.05, 0);
  });
  P.neck.scale.set(0.07, 0.08, 0.07); P.neck.position.set(0, shoulder + 0.04, 0);
  const r = 0.17;
  P.head.scale.setScalar(r); P.head.position.set(0, shoulder + 0.08 + r, 0);
  // Hair: show the parts the shape uses.
  const show = HAIR_SHAPES[hair.shape] || [];
  HAIR_PARTS.forEach((k) => { P.hair[k].visible = show.includes(k); });
  // Face.
  const F = P.face;
  const eye = { dot: [0.1, 0.1], wide: [0.14, 0.15], narrow: [0.13, 0.05] }[face.eyes] || [0.1, 0.1];
  F.eyeL.scale.set(eye[0], eye[1], 0.06); F.eyeR.scale.set(eye[0], eye[1], 0.06);
  const thick = face.brows === 'thick' ? 0.09 : 0.045, tilt = face.brows === 'arched' ? 0.3 : 0;
  F.browL.scale.set(0.26, thick, 0.05); F.browR.scale.set(0.26, thick, 0.05);
  F.browL.rotation.z = tilt; F.browR.rotation.z = -tilt;
  F.smile.visible = face.mouth === 'smile'; F.flat.visible = face.mouth === 'flat'; F.grin.visible = face.mouth === 'grin';
  const glasses = face.extra === 'glasses';
  F.glassL.visible = glasses; F.glassR.visible = glasses; F.bridge.visible = glasses;
  F.freckles.visible = face.extra === 'freckles';
  F.beard.visible = face.extra === 'beard';
  const top = P.head.position.y + r * (P.hair.crown.visible ? 1.33 : P.hair.bun.visible ? 1.42 : 1);
  d.height = top;
  d.look = { body: l.body || null, skin: l.skin || null, hair: l.hair || null, face: l.face || null };
  d.skinHex = '#' + m.skin.color.getHexString();
  return group;
}
