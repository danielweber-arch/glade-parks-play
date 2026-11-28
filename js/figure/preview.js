// N438: the creator's live figure preview. A small canvas beside the choices; the figure turns slowly (fixed at a
// three quarter view under reduced motion) and a mouse drag on the canvas turns it. The root is aria-hidden and holds
// nothing tabbable, so it never takes focus. It renders only while its root is in the page: dispose() (or the root
// leaving the page) stops the loop and frees the renderer.
/* global THREE */
import { makeFigure, applyLook } from './figure.js';

const val = (e, f) => (e && e.value !== undefined ? e.value : f);

function reduced() {
  const root = document.documentElement.getAttribute('data-reduce-motion');
  if (root === 'on') return true;
  if (root === 'off') return false;
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}

// Returns null (and draws nothing) when three.js or WebGL is missing; the creator then works as before.
export function mountPreview(palette) {
  if (typeof THREE === 'undefined' || !palette) return null;
  const size = val(palette.previewSize, { width: 240, height: 320 });
  const turnRad = (Number(val(palette.idleTurnDegPerSec, 30)) * Math.PI) / 180;
  const fixed = (Number(val(palette.threeQuarterDeg, -30)) * Math.PI) / 180;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(size.width, size.height, false);
  const canvas = renderer.domElement;
  canvas.setAttribute('data-preview-canvas', '');
  canvas.style.width = size.width + 'px'; canvas.style.height = size.height + 'px';
  const el = document.createElement('div');
  el.className = 'creator-preview';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-creator-preview', '');
  el.append(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6a7a8c, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(1.5, 3, 2.5); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshStandardMaterial({ color: 0xffd36e, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(30, size.width / size.height, 0.1, 20);
  const figure = makeFigure(THREE, {}, palette);
  scene.add(figure);
  figure.rotation.y = fixed;

  function frame() {
    const h = figure.userData.height || 1.7;
    camera.position.set(0, h * 0.62, h * 2.15);
    camera.lookAt(0, h * 0.52, 0);
  }

  function setAttrs(look) {
    el.setAttribute('data-preview-body', look.body || '');
    el.setAttribute('data-preview-skin', look.skin || '');
    el.setAttribute('data-preview-hair', look.hair || '');
    el.setAttribute('data-preview-face', look.face || '');
  }

  let dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* no capture */ } });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; figure.rotation.y += (e.clientX - lastX) * 0.012; lastX = e.clientX; });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);

  let raf = 0, last = 0, gone = false, wasReduced = null;
  function tick(t) {
    if (gone) return;
    if (!el.isConnected && last) { dispose(); return; }
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t || 1;
    const r = reduced();
    if (r && wasReduced !== true) figure.rotation.y = fixed; // entering reduced motion snaps to the fixed view
    wasReduced = r;
    if (!r && !dragging) figure.rotation.y += turnRad * dt;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  function show(look) {
    applyLook(figure, look, palette);
    setAttrs(figure.userData.look);
    frame();
    if (!gone) renderer.render(scene, camera);
  }

  function dispose() {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    Object.values(figure.userData.mats).forEach((m) => m.dispose());
    floor.material.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* already lost */ }
    canvas.remove();
    if (window.gpCreatorPreview && window.gpCreatorPreview.owner === el) delete window.gpCreatorPreview;
  }

  raf = requestAnimationFrame(tick);
  return {
    el, show, dispose, figure,
    rotation: () => figure.rotation.y,
    isDisposed: () => gone,
  };
}
