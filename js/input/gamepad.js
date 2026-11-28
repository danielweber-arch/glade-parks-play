// Gamepad: polls navigator.getGamepads each frame (standard mapping), applies
// the dead zone and repeat timing from the map, and sends focus intents.
import { uiMap, tunable } from './map.js';

const DPAD = { 'button:12': 'up', 'button:13': 'down', 'button:14': 'left', 'button:15': 'right' };
const AXIS = { 'axis:1-': 'up', 'axis:1+': 'down', 'axis:0-': 'left', 'axis:0+': 'right' };

function readBinding(pad, id, dead) {
  const [kind, rest] = id.split(':');
  if (kind === 'button') { const b = pad.buttons[Number(rest)]; return !!(b && (b.pressed || b.value > 0.5)); }
  if (kind === 'axis') {
    const v = pad.axes[Number(rest.slice(0, -1))] || 0;
    return rest.endsWith('+') ? v > dead : v < -dead;
  }
  return false;
}

// N357: the pad opens 3D build and the city map (UI map OpenBuild, OpenCity) from any screen; an open overlay takes the rest.
function openMode(it) {
  const f = it === 'build' ? window.gpBuild : it === 'city' ? window.gpCity : null;
  if (it !== 'build' && it !== 'city') return false;
  if (!document.querySelector('[data-build], [data-city]') && typeof f === 'function') f();
  return true;
}

export function attachGamepad(map, focus, { onConnect } = {}) {
  if (!navigator.getGamepads) return;
  const ui = uiMap(map);
  const dead = tunable(map, 'stickDeadZone', 0.35);
  const delay = tunable(map, 'repeatDelayMs', 400);
  const rate = tunable(map, 'repeatRateMs', 120);
  const binds = (id) => ((ui.actions || []).find((a) => a.id === id) || {}).pad || [];
  const table = [];
  for (const b of binds('Navigate')) if (DPAD[b] || AXIS[b]) table.push([b, DPAD[b] || AXIS[b], true]);
  for (const [id, it] of [['Submit', 'submit'], ['Cancel', 'cancel'], ['OpenPhone', 'phone'], ['OpenBuild', 'build'], ['OpenCity', 'city']]) for (const b of binds(id)) table.push([b, it, false]);
  const held = new Map(); // intent -> { since, next }
  let seen = false;

  function frame(now) {
    const pads = [...(navigator.getGamepads() || [])].filter(Boolean);
    if (pads.length && !seen) { seen = true; if (onConnect) onConnect(true); }
    if (!pads.length && seen) { seen = false; if (onConnect) onConnect(false); }
    const down = new Map();
    for (const pad of pads) for (const [b, it, repeats] of table) if (readBinding(pad, b, dead)) down.set(it, repeats);
    for (const it of [...held.keys()]) if (!down.has(it)) held.delete(it);
    for (const [it, repeats] of down) {
      const h = held.get(it);
      if (!h) { held.set(it, { next: now + delay }); if (!openMode(it)) focus.intent(it); }
      else if (repeats && now >= h.next) { h.next = now + rate; focus.intent(it); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
