// P7.7 part A: overhead build camera. Numbers from Data/camera.json "overhead" ({value, source, why} rows).
// Keyboard: Q and E rotate, + and - zoom. Mouse: wheel zooms, right drag rotates.
const THREE = window.THREE;
const v = (o, k, d) => (o && o[k] && typeof o[k].value === 'number' ? o[k].value : d);

// N253: the aim point follows the cursor cell with a spring (Data/camera.json "build": followLag, edgeMargin,
// maxPanPerSecond) and stays inside the site bounds. Follow runs on key moves and placement only: following a mouse
// move would make the mouse pick a new cell as the view slides under it (the part A spec failure).
export function createOverheadCamera(cfg, center, el, build, bounds) {
  const lag = Math.max(0.01, v(build, 'followLag', 0.25)), margin = v(build, 'edgeMargin', 0.2), maxPan = v(build, 'maxPanPerSecond', 400);
  const target = { x: center.x, z: center.z };
  const clampX = (x) => (bounds ? Math.max(bounds.x0, Math.min(bounds.x1, x)) : x);
  const clampZ = (z) => (bounds ? Math.max(bounds.z0, Math.min(bounds.z1, z)) : z);
  const pitch = (v(cfg, 'pitch', 55) * Math.PI) / 180, zMin = v(cfg, 'zoomMin', 40), zMax = v(cfg, 'zoomMax', 700);
  const zStep = v(cfg, 'zoomStep', 0.12), rStep = (v(cfg, 'rotateStep', 15) * Math.PI) / 180;
  let dist = Math.min(zMax, Math.max(zMin, v(cfg, 'height', 140) / Math.sin(pitch))), yaw = 0;
  const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 5000);
  function place() {
    const h = dist * Math.sin(pitch), r = dist * Math.cos(pitch);
    cam.position.set(center.x + Math.sin(yaw) * r, h, center.z + Math.cos(yaw) * r);
    cam.lookAt(center.x, 0, center.z);
  }
  const zoom = (dir) => { dist = Math.min(zMax, Math.max(zMin, dist * (1 + dir * zStep))); place(); };
  const rotate = (dir) => { yaw += dir * rStep; place(); };
  const onWheel = (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1 : -1); };
  let drag = null;
  const onDown = (e) => { if (e.button === 2) drag = e.clientX; };
  const onMove = (e) => { if (drag != null) { yaw += (e.clientX - drag) * 0.005; drag = e.clientX; place(); } };
  const onUp = () => { drag = null; };
  const noMenu = (e) => e.preventDefault();
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  el.addEventListener('contextmenu', noMenu);
  place();
  return {
    cam,
    get distance() { return dist; },
    get yaw() { return yaw; },
    key(ev) {
      if (ev.key === 'q' || ev.key === 'Q') rotate(-1);
      else if (ev.key === 'e' || ev.key === 'E') rotate(1);
      else if (ev.key === '+' || ev.key === '=') zoom(-1);
      else if (ev.key === '-' || ev.key === '_') zoom(1);
    },
    lookAt(x, z) { center.x = target.x = clampX(x); center.z = target.z = clampZ(z); place(); },
    get center() { return { x: center.x, z: center.z }; },
    get target() { return { x: target.x, z: target.z }; },
    /** Asks the camera to follow world point (x, z) when it sits outside the inner frame (edgeMargin each side). */
    follow(x, z) {
      const p = new THREE.Vector3(x, 0, z).project(cam);
      const lim = 1 - 2 * margin;
      if (Math.abs(p.x) <= lim && Math.abs(p.y) <= lim && p.z < 1) return false;
      target.x = clampX(x); target.z = clampZ(z); return true;
    },
    /** One spring step of dt seconds toward the follow target, capped at maxPanPerSecond. */
    step(dt) {
      const dx = target.x - center.x, dz = target.z - center.z, d = Math.hypot(dx, dz);
      if (d < 0.01) return;
      let move = d * (1 - Math.exp(-dt / lag)); move = Math.min(move, maxPan * dt);
      if (d - move < 0.05) move = d;
      center.x += (dx / d) * move; center.z += (dz / d) * move; place();
    },
    resize(w, h) { cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); },
    dispose() {
      el.removeEventListener('wheel', onWheel); el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); el.removeEventListener('contextmenu', noMenu);
    },
  };
}
