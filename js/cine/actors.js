// Actors: code-made stand ins with a soft dark blob under each, and a model
// slot for later (locked decision 17). Clips are code-made and read scene time
// only, so a frame at time t always looks the same.
/* global THREE */

let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  blobTex.colorSpace = THREE.SRGBColorSpace;
  return blobTex;
}

export function createBlob(size) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.name = 'blob';
  return m;
}

const SHIRTS = [0x3f6e8c, 0x8c5a3f, 0x5d7a3a, 0x7a3a5d, 0x8c7a3f, 0x3a5d7a];

// subject: { id, center, radius, model }. Height about 1.75 m on the ground.
export function createActor(subject, index = 0) {
  const group = new THREE.Group();
  group.name = 'actor:' + subject.id;
  const stand = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 1.2, 10),
    new THREE.MeshStandardMaterial({ color: SHIRTS[index % SHIRTS.length], roughness: 0.8 }),
  );
  body.position.y = 0.6;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8b393, roughness: 0.7 }),
  );
  head.position.y = 1.45;
  head.castShadow = true;
  stand.add(body, head);
  group.add(stand, createBlob(1.1));
  group.position.set(subject.center[0], 0, subject.center[2]);
  // Face the subject's front (plus Z), turned a little toward the scene center.
  group.rotation.y = Math.atan2(-subject.center[0], -subject.center[2]) * 0.25;

  let clip = 'idle';
  let clipAt = 0;
  return {
    group,
    stand,
    id: subject.id,
    setClip(name, at) { clip = name; clipAt = at; },
    // Pose the stand in from scene time t. Reduced motion keeps it still.
    update(t, reduce) {
      const k = reduce ? 0 : t - clipAt;
      head.rotation.x = 0;
      body.scale.y = 1;
      if (clip === 'idle') body.scale.y = 1 + 0.01 * Math.sin(k * 2.1);
      else if (clip === 'emote-yes' && k < 1.2) head.rotation.x = 0.35 * Math.sin(k * Math.PI * 2.5);
    },
  };
}
