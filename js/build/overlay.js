// P7.7 part C (N307): info view overlays in build mode. The Views button (or V) cycles off, land, traffic, vacancy,
// demand, transit, off; keys 1 to 5 pick one view and 0 turns them off. Colors, legend and summary come whole from
// /api/build/views (Sim/BuildView/BuildInfoView); the client only paints one tinted plane over the site cells.
const THREE = window.THREE;
const KEYS = { 1: 'land', 2: 'traffic', 3: 'vacancy', 4: 'demand', 5: 'transit' };
const ORDER = ['land', 'traffic', 'vacancy', 'demand', 'transit'];

export function wireOverlay(root, scene, view, origin, getJson) {
  const btn = root.querySelector('[data-build-views]');
  const strip = root.querySelector('[data-build-legend]');
  const cell = view.cellMeters;
  const paint = document.createElement('canvas');
  paint.width = Math.max(1, view.nx); paint.height = Math.max(1, view.nz);
  const tex = new THREE.CanvasTexture(paint);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(view.nx * cell, view.nz * cell),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75, depthWrite: false }));
  const o0 = origin(0, 0);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(o0.x + (view.nx * cell) / 2, 0.15, o0.z + (view.nz * cell) / 2);
  mesh.visible = false; scene.add(mesh);
  let current = null, seq = 0;

  function hide() {
    current = null; mesh.visible = false; strip.hidden = true; root.dataset.view = 'off';
    btn.setAttribute('aria-pressed', 'false');
  }
  async function show(kind) {
    if (!kind) { hide(); return; }
    const my = ++seq;
    const v = await getJson('/api/build/views?kind=' + encodeURIComponent(kind)).catch(() => null);
    if (my !== seq) return;
    if (!v) { hide(); return; }
    const ctx = paint.getContext('2d');
    ctx.clearRect(0, 0, paint.width, paint.height);
    const img = ctx.createImageData(paint.width, paint.height);
    for (let k = 0; k < v.colors.length && k < paint.width * paint.height; k++) {
      const c = v.colors[k]; if (c < 0) continue;
      img.data[k * 4] = (c >> 16) & 255; img.data[k * 4 + 1] = (c >> 8) & 255; img.data[k * 4 + 2] = c & 255; img.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); tex.needsUpdate = true; mesh.visible = true; current = v.kind;
    strip.querySelector('[data-legend-title]').textContent = v.title;
    strip.querySelector('[data-legend-low]').textContent = v.legendLow;
    strip.querySelector('[data-legend-high]').textContent = v.legendHigh;
    strip.querySelector('[data-legend-ramp]').style.background = `linear-gradient(to right, ${v.ramp.join(', ')})`;
    strip.querySelector('[data-legend-summary]').textContent = v.summary;
    strip.hidden = false; root.dataset.view = v.kind; btn.setAttribute('aria-pressed', 'true');
  }
  function cycle() {
    const i = current ? ORDER.indexOf(current) : -1;
    return show(i + 1 >= ORDER.length ? null : ORDER[i + 1]);
  }
  btn.addEventListener('click', () => { cycle(); });
  root.addEventListener('build:changed', () => { if (current) show(current); });
  hide();
  return {
    cycle, show, hide,
    key(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      if (ev.key === 'v' || ev.key === 'V') { cycle(); return true; }
      if (ev.key === '0') { show(null); return true; }
      if (KEYS[ev.key]) { show(KEYS[ev.key]); return true; }
      return false;
    },
  };
}
