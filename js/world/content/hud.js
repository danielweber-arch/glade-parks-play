// N440: minimap (whole town, north up), compass with an arrow to the closest place, hint button and a screen reader line.
// Nothing here can take focus: tabindex -1 everywhere and mousedown never focuses.
import { closestAny } from './places.js';

const LETTERS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function compassLetter(heading) {
  const deg = ((heading * 180) / Math.PI % 360 + 360) % 360;
  return LETTERS[Math.round(deg / 45) % 8];
}

export function buildHud({ root, view, places, onPick, onEnter, size = 180 }) {
  const el = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const box = el('div', 'wc-hud', { 'data-world-hud': '' });
  const map = el('canvas', 'wc-minimap', { width: size, height: size, tabindex: '-1', 'aria-hidden': 'true', 'data-world-minimap': '' });
  const compass = el('div', 'wc-compass', { 'aria-hidden': 'true', 'data-world-compass': '' });
  const letter = el('span', 'wc-compass-letter'); const arrow = el('span', 'wc-compass-arrow'); arrow.textContent = '▲';
  compass.append(letter, arrow);
  const live = el('div', 'wc-sr', { 'aria-live': 'polite', 'data-world-live': '' });
  const hint = el('button', 'wc-hint', { type: 'button', tabindex: '-1', 'data-world-hint': '', hidden: '' });
  box.append(map, compass, live); root.append(box, hint);

  // Fit the town into the square, north up. drive/scene.js puts sim x on three.js x and sim z on three.js z, so a chase
  // camera facing north sees east (+x) on its LEFT. The minimap mirrors x the same way so it turns with the 3D view.
  const xs = (view.nodes || []).map((n) => n.x), zs = (view.nodes || []).map((n) => n.z);
  for (const p of places) { xs.push(p.x); zs.push(p.z); }
  const minX = Math.min(...xs) - 40, maxX = Math.max(...xs) + 40, minZ = Math.min(...zs) - 40, maxZ = Math.max(...zs) + 40;
  const scale = (size - 8) / Math.max(maxX - minX, maxZ - minZ, 1);
  const px = (x) => size - 4 - (x - minX) * scale, py = (z) => 4 + (maxZ - z) * scale;
  map.gpPoint = (id) => { const p = places.find((q) => q.id === id); if (!p) return null; const r = map.getBoundingClientRect(), k = map.clientWidth / size; return { x: r.left + map.clientLeft + px(p.x) * k, y: r.top + map.clientTop + py(p.z) * k }; };

  const base = document.createElement('canvas'); base.width = size; base.height = size;
  const bg = base.getContext('2d');
  bg.fillStyle = '#1d2b3a'; bg.fillRect(0, 0, size, size);
  for (const d of view.districts || []) { bg.fillStyle = 'rgba(120, 220, 170, 0.12)'; bg.beginPath(); bg.arc(px(d.x), py(d.z), d.radius * scale, 0, Math.PI * 2); bg.fill(); }
  const nodes = new Map((view.nodes || []).map((n) => [n.id, n]));
  for (const r of view.roads || []) {
    const a = nodes.get(r.from), b = nodes.get(r.to); if (!a || !b) continue;
    bg.strokeStyle = r.freeway ? '#ffb347' : '#d8e2ee'; bg.lineWidth = r.freeway ? 3 : 1.6;
    bg.beginPath(); bg.moveTo(px(a.x), py(a.z)); bg.lineTo(px(b.x), py(b.z)); bg.stroke();
  }
  const g = map.getContext('2d');
  function draw(car) {
    g.drawImage(base, 0, 0);
    for (const p of places) {
      g.fillStyle = p.color; g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(px(p.x), py(p.z), 6, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    if (car) {
      g.save(); g.translate(px(car.x), py(car.z)); g.rotate(-(car.heading || 0));
      g.fillStyle = '#ffe14d'; g.strokeStyle = '#000000'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  }
  draw(null);

  const noFocus = (e) => e.preventDefault();
  function onMapClick(e) {
    const r = map.getBoundingClientRect(), k = size / (map.clientWidth || size);
    const mx = (e.clientX - r.left - map.clientLeft) * k, my = (e.clientY - r.top - map.clientTop) * k;
    let best = null, bd = 14;
    for (const p of places) { const d = Math.hypot(px(p.x) - mx, py(p.z) - my); if (d < bd) { bd = d; best = p; } }
    if (best && onPick) onPick(best.id);
  }
  const onHint = () => { if (onEnter) onEnter(); };
  map.addEventListener('mousedown', noFocus); map.addEventListener('click', onMapClick);
  hint.addEventListener('mousedown', noFocus); hint.addEventListener('click', onHint);

  let lastLive = null, acc = 1;
  return {
    update(dt, car, near) {
      acc += dt; if (acc < 1 / 20) return; acc = 0;
      draw(car);
      const h = car.heading || 0; letter.textContent = compassLetter(h);
      const to = closestAny(places, car.x, car.z);
      if (to) { const bearing = Math.atan2(to.place.x - car.x, to.place.z - car.z); arrow.style.transform = `rotate(${((h - bearing) * 180) / Math.PI}deg)`; arrow.style.color = to.place.color; }
      const text = near ? 'Near ' + near.place.label : '';
      if (text !== lastLive) { live.textContent = text; lastLive = text; }
    },
    setHint(text) { if (text) { hint.textContent = text; hint.hidden = false; } else { hint.textContent = ''; hint.hidden = true; } },
    dispose() {
      map.removeEventListener('mousedown', noFocus); map.removeEventListener('click', onMapClick);
      hint.removeEventListener('mousedown', noFocus); hint.removeEventListener('click', onHint);
      box.remove(); hint.remove();
    },
  };
}
