// The stage: ground, subject buildings, low neighbors, sun, hemisphere light,
// fog and a code-made sky. Look baseline of section 9: sRGB output, filmic
// tone mapping, one sun with one 2048 soft shadow map, no HDR, no post pass.
// One interface for the rig: subject(id) gives { center, radius, height }.
/* global THREE */
import { createSky } from './sky.js';
import { createActor, createBlob } from './actors.js';

export const MAX_BACKING = [1920, 1080]; // section 12
const FLOOR_M = 3.5; // Data/art/models.json floorHeightM
const MODEL_WAIT_MS = 300; // locked decision 17

// Built in look until the mood data arrives (P12.2 / P12.5).
export const DEFAULT_LOOK = {
  exposure: 1.0,
  skyTop: 0x5d8fc9, skyHorizon: 0xf2d6b0, skyBottom: 0x8a8f7a,
  fog: 0xd9cdb8, sunColor: 0xfff1dc, sunIntensity: 2.4, sunDir: [-0.5, 0.75, 0.45],
  hemiSky: 0xcfe0ff, hemiGround: 0x6b6450, hemiIntensity: 0.9,
};

export function backingSize(cssW, cssH, dpr) {
  const pr = Math.min(dpr || 1, MAX_BACKING[0] / cssW, MAX_BACKING[1] / cssH);
  return { pr, w: Math.floor(cssW * pr), h: Math.floor(cssH * pr) };
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildingStandIn(s, color) {
  const h = Math.max(1, s.floors || 1) * FLOOR_M;
  const side = s.radius * 1.1;
  const g = new THREE.Group();
  const body = box(side, h, side * 0.8, color);
  body.position.y = h / 2;
  g.add(body);
  g.position.set(s.center[0], 0, s.center[2]);
  return { group: g, height: h };
}

function propStandIn(s) {
  const g = new THREE.Group();
  const post = box(0.08, 1.6, 0.08, 0x6b4f35);
  post.position.y = 0.8;
  const panel = box(1.2, 0.7, 0.05, 0xc8463a);
  panel.position.y = 1.5;
  g.add(post, panel, createBlob(1.4));
  g.position.set(s.center[0], 0, s.center[2]);
  return { group: g, height: 1.9 };
}

// Model slot: try the glTF; the stand in shows if it is not ready in 300 ms.
function modelSlot(scene, s, standIn, modelBase) {
  if (!s.model || !THREE.GLTFLoader) { scene.add(standIn); return; }
  let done = false;
  const timer = setTimeout(() => { if (!done) scene.add(standIn); }, MODEL_WAIT_MS);
  const url = modelBase + s.model.split('/').map(encodeURIComponent).join('/');
  new THREE.GLTFLoader().load(url, (gltf) => {
    done = true;
    clearTimeout(timer);
    const m = gltf.scene;
    const b = new THREE.Box3().setFromObject(m);
    const size = b.getSize(new THREE.Vector3());
    const k = (s.radius * 1.1) / Math.max(size.x, size.z, 1e-3);
    m.scale.setScalar(k);
    m.position.set(s.center[0], -b.min.y * k, s.center[2]);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.remove(standIn);
    scene.add(m);
  }, undefined, () => { done = true; clearTimeout(timer); scene.add(standIn); });
}

export function createStage({ canvas, list, look = DEFAULT_LOOK, modelBase = '../models/' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const subjects = {};
  const actors = [];
  let extent = 30;
  const all = (list.set && list.set.subjects) || [];
  for (const s of all) extent = Math.max(extent, Math.hypot(s.center[0], s.center[2]) + s.radius * 3);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(extent * 8, extent * 8),
    new THREE.MeshStandardMaterial({ color: 0x7d8a5a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let people = 0;
  let mainBuilding = null;
  for (const s of all) {
    let made;
    if (s.kind === 'building') {
      made = buildingStandIn(s, mainBuilding ? 0xa49a8a : 0xc9b79a);
      if (!mainBuilding) mainBuilding = s;
    } else if (s.kind === 'person') {
      const a = createActor(s, people++);
      actors.push(a);
      made = { group: a.group, height: 1.75 };
    } else {
      made = propStandIn(s);
    }
    modelSlot(scene, s, made.group, modelBase);
    subjects[s.id] = { center: s.center.slice(), radius: s.radius, height: made.height };
  }

  // Low neighbors on a fixed ring around the main building (no random picks).
  if (mainBuilding) {
    const R = mainBuilding.radius;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const d = R * (3 + (i % 2));
      const n = box(R * 0.7, FLOOR_M * (1 + (i % 3)), R * 0.6, 0x9a9488);
      n.position.set(mainBuilding.center[0] + Math.sin(a) * d, n.geometry.parameters.height / 2, mainBuilding.center[2] + Math.cos(a) * d);
      scene.add(n);
    }
  }

  const hemi = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, look.hemiIntensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(look.sunColor, look.sunIntensity);
  const sd = new THREE.Vector3(...look.sunDir).normalize();
  sun.position.copy(sd.multiplyScalar(extent * 3));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  const sc = sun.shadow.camera;
  sc.left = -extent; sc.right = extent; sc.top = extent; sc.bottom = -extent;
  sc.near = 1; sc.far = extent * 7;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  scene.fog = new THREE.Fog(look.fog, extent * 2, extent * 12);
  const skyR = extent * 20;
  scene.add(createSky(look, skyR));
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, skyR * 1.5);

  let backing = [0, 0];
  function resize(cssW, cssH, dpr) {
    const b = backingSize(cssW, cssH, dpr);
    renderer.setPixelRatio(b.pr);
    renderer.setSize(cssW, cssH, false);
    backing = [canvas.width, canvas.height];
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
  }

  function render(pose, t, reduce) {
    for (const a of actors) a.update(t, reduce);
    if (pose) {
      camera.position.set(...pose.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(...pose.target);
      if (pose.roll) camera.rotateZ((pose.roll * Math.PI) / 180);
      if (camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
    }
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, actors,
    subject: (id) => subjects[id] || null,
    resize, render,
    info: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      backing: backing.slice(),
    }),
    dispose: () => renderer.dispose(),
  };
}
