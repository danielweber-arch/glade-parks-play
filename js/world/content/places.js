// N440: resolve Data/ui/world-places.json against /api/city/view into the places list. Pure, no three.js, node can test it.
const num = (v, d) => (v && typeof v === 'object' && 'value' in v ? v.value : v ?? d);
export const OPENS = ['build', 'money', 'people', 'city', 'end'];

// Where the player's site sits: view.properties[0], else the first lot marked 'mine'. Null when neither exists.
export function siteAnchor(view) {
  const p = (view.properties || [])[0];
  if (p) return { x: p.x, z: p.z, district: p.district };
  const lot = (view.lots || []).find((l) => l.status === 'mine');
  return lot ? { x: lot.x, z: lot.z, district: lot.district } : null;
}

function closestNode(nodes, p) {
  let best = null, bd = Infinity;
  for (const n of nodes) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } }
  return best;
}

// Returns [{ id, label, opens, x, z, radius, color, district }]. A place whose anchor is missing is left out.
export function resolvePlaces(file, view) {
  const out = [];
  const landmarks = new Map((view.landmarks || []).map((l) => [l.id, l]));
  const nodes = new Map((view.nodes || []).map((n) => [n.id, n]));
  for (const e of (file && file.places) || []) {
    let base = null, label = e.label || '', district = e.district || '';
    if (e.anchor === 'site') { base = siteAnchor(view); if (base && !district) district = base.district || ''; }
    // CityView puts a site at its district center, which can be far from any road (hill: 136 m). snapToNode moves it to
    // the closest road node so a car can reach it.
    if (base && e.snapToNode) base = closestNode(view.nodes || [], base) || base;
    else if (landmarks.has(e.anchor)) { const l = landmarks.get(e.anchor); base = l; if (!label) label = l.name; if (!district) district = l.district || ''; }
    else if (nodes.has(e.anchor)) base = nodes.get(e.anchor);
    if (!base) continue;
    const [dx, dz] = num(e.offset, [0, 0]) || [0, 0];
    out.push({ id: e.id, label: label || e.id, opens: e.opens, x: base.x + dx, z: base.z + dz, radius: num(e.radius, 25), color: e.color || '#ffffff', district });
  }
  return out;
}

// The closest place whose ring holds (x, z), as { place, dist }, else null.
export function nearestPlace(places, x, z) {
  let best = null;
  for (const p of places) {
    const dist = Math.hypot(p.x - x, p.z - z);
    if (dist <= p.radius && (!best || dist < best.dist)) best = { place: p, dist };
  }
  return best;
}

// Closest place by distance alone (the compass arrow points at it).
export function closestAny(places, x, z) {
  let best = null;
  for (const p of places) { const dist = Math.hypot(p.x - x, p.z - z); if (!best || dist < best.dist) best = { place: p, dist }; }
  return best;
}

// Distance from (x, z) to segment a-b.
export function segDist(a, b, x, z) {
  const vx = b.x - a.x, vz = b.z - a.z, L = vx * vx + vz * vz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L)) : 0;
  return Math.hypot(a.x + vx * t - x, a.z + vz * t - z);
}
