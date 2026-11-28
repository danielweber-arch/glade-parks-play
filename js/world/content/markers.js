// N440: a bright pillar, a glowing ring and a floating label per place. mesh.userData.placeId is set on every part.
export const GROUP_COLORS = { build: '#ff7a1a', money: '#2fbf5b', people: '#3b82f6', city: '#a855f7', end: '#f43f5e' };

function labelTexture(THREE, text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; roundRect(g, 4, 4, 504, 120, 28); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#ffffff'; roundRect(g, 8, 8, 496, 112, 24); g.stroke();
  g.fillStyle = '#ffffff'; g.font = 'bold 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66, 470);
  const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function buildMarkers(THREE, scene, places, height = 36) {
  const group = new THREE.Group(); group.name = 'world-content-markers';
  const parts = [];
  for (const p of places) {
    const color = new THREE.Color(p.color || GROUP_COLORS[p.opens] || '#ffffff');
    const m = new THREE.Group(); m.position.set(p.x, 0, p.z); m.userData.placeId = p.id; m.name = 'marker-' + p.id;
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.45 });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, height, 12), mat);
    pillar.position.y = height / 2;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(4), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.8 }));
    cap.position.y = height + 5; cap.name = 'cap';
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(1, p.radius - 1.5), p.radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(THREE, p.label, '#' + color.getHexString()), depthTest: false }));
    sprite.scale.set(28, 7, 1); sprite.position.y = height + 14; sprite.renderOrder = 10;
    for (const part of [pillar, cap, ring, sprite]) { part.userData.placeId = p.id; m.add(part); }
    group.add(m); parts.push(m);
  }
  scene.add(group);
  let t = 0;
  return {
    group, markers: parts,
    tick(dt, still) { if (still) return; t += dt; for (const m of parts) { const cap = m.getObjectByName('cap'); if (cap) { cap.rotation.y = t * 1.5; cap.position.y = height + 5 + Math.sin(t * 2) * 1.2; } } },
    dispose() {
      scene.remove(group);
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    },
  };
}
