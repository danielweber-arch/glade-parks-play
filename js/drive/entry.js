// P7.9 part C: graybox drive mode. Open with window.gpDrive.open() or the city map's Drive button; Escape or Leave goes back
// to the city map. The host owns every rule: DrivePast (every drive.json throttleSeconds) says if a lot was revealed through
// the reply's typed Value (N281); the client then reads which lot from /api/city/view, never from messages.
import { createChase } from './camera.js';
import { buildScene, carMesh, nearestRoad } from './scene.js';
import { createDriveInput, stepCar, CAR } from './input.js';
import { startExtras } from './extras.js';
import { startPicker, readPending } from './picker.js';

async function getJson(url) { const r = await fetch(url, { headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
export async function command(name, args) {
  const t = window.gp && window.gp.transport; // r58 j6: the app transport when running (http, wasm, stub)
  if (t && typeof t.command === 'function') return t.command({ name, args: args || {} });
  const r = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, args: args || {} }) });
  return r.json();
}
function el(tag, attrs, text) { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
function three() {
  if (window.THREE) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/three.min.js'; s.onload = ok; s.onerror = () => no(new Error('three.js did not load')); document.head.appendChild(s); });
}
function css() {
  if (document.querySelector('link[data-city-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/city.css'; l.setAttribute('data-city-css', ''); document.head.appendChild(l);
}

let live = null;
export async function openDrive({ start } = {}) {
  if (live) return live;
  css(); await three();
  const THREE = window.THREE;
  const [view, cam, tun] = await Promise.all([getJson('/api/city/view'), getJson('/api/city/camera'), getJson('/api/city/drive')]);
  const len = (cam.sedan && cam.sedan.length && cam.sedan.length.value) || CAR.length, hgt = (cam.sedan && cam.sedan.height && cam.sedan.height.value) || CAR.height;

  const root = el('section', { 'data-drive': '', 'data-ready': '0', role: 'application', 'aria-label': 'Drive' });
  const canvas = el('canvas', { 'data-drive-canvas': '', tabindex: '0' });
  const tag = el('p', { 'data-drive-tag': '' }, 'graybox');
  const hud = el('p', { 'data-drive-hud': '' }, '');
  const toast = el('p', { 'data-drive-toast': '', 'aria-live': 'polite' }, '');
  const help = el('p', { 'data-drive-help': '' }, 'W A S D or arrows to drive. Drag the mouse to look. C looks behind. Esc goes back to the map.');
  const leave = el('button', { type: 'button', 'data-drive-leave': '' }, 'Back to map');
  root.append(canvas, tag, hud, toast, help, leave);
  document.body.appendChild(root);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  const world = buildScene(view);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000);
  const mesh = carMesh(len, hgt); world.scene.add(mesh);
  const s0 = start || view.properties[0] || view.nodes[0] || { x: 0, z: 0 };
  const car = Object.assign({ speed: 0 }, nearestRoad(world.segments, s0.x, s0.z));
  const chase = createChase(cam, len, hgt);
  const input = await createDriveInput(canvas);
  let forSale = new Set(view.lots.filter((l) => l.status === 'for_sale').map((l) => l.id));
  let pose = null, busy = false, since = 0, running = true, toastUntil = 0, found = 0;

  function say(text, secs) { toast.textContent = text; toastUntil = performance.now() + (secs || 4) * 1000; }
  async function drivePast() {
    busy = true;
    try {
      const r = await command('DrivePast', { x: car.x, z: car.z });
      if (r && r.value === 1) {
        const v = await getJson('/api/city/view');
        const lot = v.lots.find((l) => l.status === 'for_sale' && !forSale.has(l.id));
        forSale = new Set(v.lots.filter((l) => l.status === 'for_sale').map((l) => l.id));
        if (lot) { world.markFound(lot); found++; root.setAttribute('data-found', lot.id); root.setAttribute('data-found-count', String(found)); }
        say('You spotted a for sale sign. The lot is on your deal list now.', 5);
      }
    } catch (e) { /* a missed check is retried on the next tick */ } finally { busy = false; }
  }
  function resize() {
    const w = root.clientWidth || 1280, h = root.clientHeight || 720;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);
  const picker = startPicker({ root, command }); // claims gp-encounter before extras can fire it
  const extras = startExtras({ root, world, car, say, command, stopCar: () => { car.speed = 0; } });
  readPending().then((c) => { if (c && running && !extras.paused()) extras.meet(c.id || '', c.district || ''); }).catch(() => {}); // one already waiting

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000); last = now; // slow frames still move in real time (substeps below)
    const inp = input.read();
    if (inp.leave && !root.hasAttribute('data-encounter-open')) { close(); return; } // r58 j6: Escape does not drop a waiting reply
    if (!extras.paused()) for (let left = dt; left > 1e-6; left -= 0.05) stepCar(car, inp, Math.min(0.05, left));
    mesh.position.set(car.x, 0, car.z); mesh.rotation.y = car.heading;
    pose = chase.update(dt, car, Math.abs(car.speed) / CAR.top, inp.look);
    camera.position.set(pose.x, pose.y, pose.z); camera.lookAt(pose.aim.x, pose.aim.y, pose.aim.z);
    if (Math.abs(camera.fov - pose.fov) > 1e-3) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
    since += dt;
    if (since >= tun.throttleSeconds && !busy) { since = 0; drivePast(); }
    extras.tick(dt);
    hud.textContent = Math.round(Math.abs(car.speed) * 2.237) + ' mph';
    if (toastUntil && now > toastUntil) { toast.textContent = ''; toastUntil = 0; }
    renderer.render(world.scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function close() {
    if (!running) return;
    running = false; input.dispose(); extras.dispose(); picker.dispose(); window.removeEventListener('resize', resize);
    renderer.dispose(); root.remove(); live = null;
    if (window.gpCity) window.gpCity();
  }
  leave.onclick = close;
  canvas.focus();
  root.setAttribute('data-ready', '1');
  live = {
    root, close, car, chase,
    /** Measured camera numbers: horizontal distance behind the car, pitch down from the aim point, FOV (Playwright). */
    pose() {
      const p = camera.position, a = pose.aim, flat = Math.hypot(p.x - a.x, p.z - a.z);
      return { behind: Math.hypot(p.x - car.x, p.z - car.z), height: p.y, pitchDown: Math.atan2(p.y - a.y, flat) * 180 / Math.PI, fov: camera.fov, rest: chase.rest };
    },
    teleport(x, z) { const r = nearestRoad(world.segments, x, z); Object.assign(car, r, { speed: 0 }); },
  };
  return live;
}

window.gpDrive = { open: openDrive, get live() { return live; } };
