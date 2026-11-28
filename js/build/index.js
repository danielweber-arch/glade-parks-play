// P7.7 part A: build mode in 3D. Draws the current site from /api/build/site (Data/maps plus the live site) with an
// overhead camera (Data/camera.json "overhead"), a grid, a cursor that moves by cell, code-made shapes, a one-line
// blocked reason under the cursor and Demolish on a selected building. The client holds no game rules: reasons and
// costs come from the host.
import { makeBuilding } from './shapes.js';
import { createOverheadCamera } from './camera.js';
import { wirePlace, command, currentSiteId } from './place.js';
// N357: Demolish carries the site; SetBuildMode opens and closes the clock's build mode.
async function demolishCall(id, fallback) {
  const reply = await command('Demolish', { BuildingId: id, SiteId: await currentSiteId(fallback) });
  return { ok: !reply.error, json: async () => reply };
}
function buildMode(open) { command('SetBuildMode', { open }).catch(() => {}); }
import { wireCard } from './card.js';
import { wireWheel } from './wheel.js';
import { wireOverlay } from './overlay.js';

const THREE = window.THREE;
const TYPES = [[1, 'Shops'], [7, 'Apartments'], [2, 'Offices'], [12, 'Parking lot']];
const GROUND = [0x9cb07f, 0xb8b08a, 0x8da070, 0x5b8fb5]; // flat, bank, hill, water

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function openBuild(host = document.body) {
  const root = document.createElement('section');
  root.className = 'build';
  root.setAttribute('data-build', '');
  root.innerHTML = `
    <canvas class="build-canvas" data-build-canvas tabindex="0" aria-label="Site view"></canvas>
    <div class="build-bar">
      <label class="build-type">Build <select data-build-type>${TYPES.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select></label>
      <span class="build-cell" data-build-cell></span>
      <span class="build-cash" data-build-cash></span>
      <button type="button" data-build-tools aria-keyshortcuts="T">Tools</button>
      <button type="button" data-build-views aria-keyshortcuts="V 1 2 3 4 5 0" aria-pressed="false">Views</button>
      <button type="button" data-build-place>Place</button>
      <button type="button" data-build-start>Start building</button>
      <button type="button" data-build-undo>Undo</button>
      <button type="button" class="build-close" data-build-close>Close</button>
    </div>
    <p class="build-reason" data-build-reason role="status" aria-live="polite"></p>
    <div class="build-card" data-build-card hidden>
      <span data-build-name></span>
      <button type="button" data-build-demolish>Demolish</button>
      <span class="build-why" data-build-why></span>
    </div>
    <aside class="build-details" data-build-details hidden></aside>
    <div class="build-wheel" data-build-wheel hidden></div>
    <aside class="build-report" data-build-report aria-live="polite"></aside>
    <div class="build-legend" data-build-legend hidden>
      <strong data-legend-title></strong>
      <span class="build-legend-row"><span data-legend-low></span><span class="build-legend-ramp" data-legend-ramp></span><span data-legend-high></span></span>
      <p data-legend-summary role="status" aria-live="polite"></p>
    </div>`;
  host.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const canvas = $('[data-build-canvas]');
  const [view, camAll] = await Promise.all([getJson('/api/build/site'), getJson('/api/build/camera')]);
  const cam = camAll.overhead || camAll;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ee);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(-200, 400, -150); scene.add(sun);

  const cell = view.cellMeters;
  const origin = (i, j) => ({ x: (i + view.offsetI) * cell, z: (j + view.offsetJ) * cell });
  const center = { ...origin(view.nx / 2, view.nz / 2) };
  const lo = origin(0, 0), hi = origin(view.nx, view.nz);
  const camera = createOverheadCamera(cam, center, canvas, camAll.build, { x0: lo.x, z0: lo.z, x1: hi.x, z1: hi.z });

  // Ground: the whole map, then the site cells by ground kind, then roads and sidewalks as flat ribbons.
  const base = new THREE.Mesh(new THREE.PlaneGeometry(view.maxX, view.maxZ), new THREE.MeshLambertMaterial({ color: 0xa9b69a }));
  base.rotation.x = -Math.PI / 2; base.position.set(view.maxX / 2, -0.05, view.maxZ / 2); scene.add(base);
  const tile = new THREE.PlaneGeometry(cell, cell);
  const mats = GROUND.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let k = 0; k < view.ground.length; k++) {
    const gk = view.ground[k]; if (!gk) continue;
    const m = new THREE.Mesh(tile, mats[gk] || mats[0]); const o = origin(k % view.nx, Math.floor(k / view.nx));
    m.rotation.x = -Math.PI / 2; m.position.set(o.x + cell / 2, 0, o.z + cell / 2); scene.add(m);
  }
  const ribbon = (line, color, y) => {
    const mat = new THREE.MeshLambertMaterial({ color });
    for (let p = 1; p < line.points.length; p++) {
      const a = line.points[p - 1], b = line.points[p]; const dx = b[0] - a[0], dz = b[2] - a[2]; const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, Math.max(0.5, line.widthM)), mat);
      m.position.set((a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2); m.rotation.y = -Math.atan2(dz, dx); scene.add(m);
    }
  };
  view.roads.forEach((r) => ribbon(r, 0x4a4d52, 0.05));
  view.sidewalks.forEach((r) => ribbon(r, 0xc9c6bd, 0.08));
  view.water.forEach((w) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry((w.i1 - w.i0 + 1) * cell, 0.05, (w.j1 - w.j0 + 1) * cell), new THREE.MeshLambertMaterial({ color: GROUND[3] }));
    m.position.set((w.i0 + w.i1 + 1) / 2 * cell, 0.02, (w.j0 + w.j1 + 1) / 2 * cell); scene.add(m);
  });

  // Grid over the site cells.
  const pts = [];
  const a = origin(0, 0), z = origin(view.nx, view.nz);
  for (let i = 0; i <= view.nx; i++) { const x = a.x + i * cell; pts.push(x, 0.12, a.z, x, 0.12, z.z); }
  for (let j = 0; j <= view.nz; j++) { const zz = a.z + j * cell; pts.push(a.x, 0.12, zz, z.x, 0.12, zz); }
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x2e3a46, transparent: true, opacity: 0.25 })));

  // Buildings.
  const shapes = new Map();
  for (const b of view.buildings) { const g = makeBuilding(b, cell, origin); shapes.set(b.id, { g, b }); scene.add(g); }

  const details = wireCard(root, getJson);
  // Cursor.
  const cursorMesh = new THREE.Mesh(new THREE.BoxGeometry(cell, 0.4, cell), new THREE.MeshBasicMaterial({ color: 0x2b7de9, transparent: true, opacity: 0.45 }));
  scene.add(cursorMesh);
  const state = { i: Math.floor(view.nx / 2), j: Math.floor(view.nz / 2), type: TYPES[0][0], floors: 1, tier: 1, selected: null, cash: view.cash, checkSeq: 0, siteId: view.siteId || view.site || '' };
  buildMode(true);

  async function check() {
    const seq = ++state.checkSeq;
    const r = await getJson(`/api/build/check?x=${state.i}&y=${state.j}&type=${state.type}`).catch(() => ({ reason: '' }));
    if (seq !== state.checkSeq) return;
    const shown = r.reason || state.refusal || '';
    $('[data-build-reason]').textContent = shown;
    root.toggleAttribute('data-blocked', !!shown);
    cursorMesh.material.color.set(r.reason ? 0xd2453a : 0x2b7de9);
  }
  function placeCursor() {
    state.i = Math.max(0, Math.min(view.nx - 1, state.i)); state.j = Math.max(0, Math.min(view.nz - 1, state.j));
    const o = origin(state.i, state.j); cursorMesh.position.set(o.x + cell / 2, 0.2, o.z + cell / 2);
    $('[data-build-cell]').textContent = `Cell ${state.i}, ${state.j}`;
    root.dataset.cursor = state.i + ',' + state.j;
    check();
  }
  function followCursor() { const o = origin(state.i, state.j); camera.follow(o.x + cell / 2, o.z + cell / 2); }
  function buildingAt(i, j) {
    for (const { b } of shapes.values()) {
      const [i0, j0, i1, j1] = [Math.min(b.rect[0], b.rect[2]), Math.min(b.rect[1], b.rect[3]), Math.max(b.rect[0], b.rect[2]), Math.max(b.rect[1], b.rect[3])];
      if (i >= i0 && i <= i1 && j >= j0 && j <= j1) return b;
    }
    return null;
  }
  function select(b) {
    state.selected = b; const card = $('[data-build-card]'); card.hidden = !b; details.show(b && b.id);
    if (!b) return;
    $('[data-build-name]').textContent = b.name;
    $('[data-build-why]').textContent = b.demolishNo || '';
    $('[data-build-demolish]').disabled = !!b.demolishNo;
  }
  function showCash() { $('[data-build-cash]').textContent = 'Cash ' + Math.round(state.cash).toLocaleString('en-US'); root.dataset.cash = String(state.cash); }

  $('[data-build-demolish]').addEventListener('click', async () => {
    const b = state.selected; if (!b) return;
    const r = await demolishCall(b.id, state.siteId);
    const reply = r.ok ? await r.json() : null;
    const fresh = await getJson('/api/build/site');
    if (!fresh.buildings.some((x) => x.id === b.id)) { const s = shapes.get(b.id); scene.remove(s.g); shapes.delete(b.id); select(null); }
    else $('[data-build-why]').textContent = (reply && reply.error) || 'It did not come down.';
    state.cash = fresh.cash; showCash(); root.dataset.buildings = String(shapes.size); check();
  });
  $('[data-build-type]').addEventListener('change', (e) => { state.type = +e.target.value; state.floors = 1; check(); });
  $('[data-build-close]').addEventListener('click', () => close());

  const ray = new THREE.Raycaster(); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
  function cellFromMouse(ev) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera.cam);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { i: Math.floor(hit.x / cell) - view.offsetI, j: Math.floor(hit.z / cell) - view.offsetJ };
  }
  canvas.addEventListener('mousemove', (ev) => { const c = cellFromMouse(ev); if (c && (c.i !== state.i || c.j !== state.j) && c.i >= 0 && c.j >= 0 && c.i < view.nx && c.j < view.nz) { state.i = c.i; state.j = c.j; placeCursor(); } });
  canvas.addEventListener('click', () => select(buildingAt(state.i, state.j)));
  function onKey(ev) {
    ev.stopPropagation(); // build mode owns the keys while open; the game keyboard map listens on window
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (step) { state.i += step[0]; state.j += step[1]; placeCursor(); followCursor(); ev.preventDefault(); return; }
    if (wheel.key(ev)) { ev.preventDefault(); return; }
    if (placer.key(ev)) { ev.preventDefault(); return; }
    if (overlay.key(ev)) { ev.preventDefault(); return; }
    if (ev.key === 'Enter' || ev.key === ' ') { select(buildingAt(state.i, state.j)); ev.preventDefault(); return; }
    if (ev.key === 'Escape') { if (state.selected) select(null); else close(); return; }
    camera.key(ev);
  }
  root.addEventListener('keydown', onKey);

  // Place, start and undo all go to the host as Sim commands (PlaceRect, StartConstruction, Undo); the host redraws.
  function redraw(fresh) {
    for (const [id, s] of shapes) if (!fresh.buildings.some((x) => x.id === id)) { scene.remove(s.g); shapes.delete(id); }
    for (const b of fresh.buildings) if (!shapes.has(b.id)) { const g = makeBuilding(b, cell, origin); shapes.set(b.id, { g, b }); scene.add(g); }
    for (const b of fresh.buildings) shapes.get(b.id).b = b;
    state.cash = fresh.cash; showCash(); root.dataset.buildings = String(shapes.size);
    root.dispatchEvent(new CustomEvent('build:changed', { detail: fresh }));
    return check(); // the caller writes a refusal after the cell check, so the check does not wipe it
  }
  const wheel = wireWheel(root, state, { getJson, check });
  const overlay = wireOverlay(root, scene, view, origin, getJson);
  const placer = wirePlace(root, state, { getJson, redraw, followCursor, say: (t) => { $('[data-build-reason]').textContent = t; } });

  let raf = 0, last = performance.now();
  function frame() {
    const now = performance.now(); camera.step(Math.min(0.5, (now - last) / 1000)); // slow software GL frames still converge last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); camera.resize(w, h); }
    renderer.render(scene, camera.cam); raf = requestAnimationFrame(frame);
  }
  function close() { cancelAnimationFrame(raf); camera.dispose(); renderer.dispose(); root.remove(); buildMode(false); window.dispatchEvent(new Event('gp-redraw')); }

  showCash(); placeCursor(); details.refresh(); root.dataset.buildings = String(shapes.size); root.dataset.ready = '1';
  canvas.focus(); frame();
  window.gpBuildView = { camera, view, origin, state, canvas };
  return { root, close, view };
}
