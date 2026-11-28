// P7.9 part C: drive controls. Keyboard WASD or arrows, mouse drag to look, C to look behind, Escape to leave.
// Controller: left stick steers, right trigger gas, left trigger brake, right stick looks, right stick press looks behind,
// with the stick dead zone from the shared input map (Data/ui/input-map.json tunables.stickDeadZone).
import { loadInputMap, tunable } from '../input/map.js';

export async function createDriveInput(target) {
  let dead = 0.35;
  try { dead = tunable(await loadInputMap(), 'stickDeadZone', 0.35); } catch (e) { /* keep the default */ }
  const keys = new Set(); let mdx = 0, mdy = 0, drag = false, esc = false;
  // r59 j6: Escape is latched until the next read. A quick tap (down and up inside one frame) was lost from the held set,
  // so leaving the drive by key failed whenever the press was shorter than a frame.
  const onKey = (e) => { if (e.type === 'keydown') { keys.add(e.code); if (e.code === 'Escape') esc = true; } else keys.delete(e.code); };
  const onDown = (e) => { drag = true; e.preventDefault(); };
  const onUp = () => { drag = false; };
  const onMove = (e) => { if (drag) { mdx -= e.movementX * 0.25; mdy += e.movementY * 0.15; } };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  target.addEventListener('mousedown', onDown); window.addEventListener('mouseup', onUp); window.addEventListener('mousemove', onMove);
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  const dz = (v) => (Math.abs(v) < dead ? 0 : (v - Math.sign(v) * dead) / (1 - dead));
  const k = (...c) => c.some((x) => keys.has(x));

  return {
    read() {
      let throttle = (k('KeyW', 'ArrowUp') ? 1 : 0), brake = (k('KeyS', 'ArrowDown') ? 1 : 0);
      let steer = (k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0);
      let lookDx = mdx, lookDy = mdy, behind = k('KeyC'); mdx = 0; mdy = 0;
      const leave = esc || k('Escape'); esc = false;
      const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
      for (const p of pads) {
        if (!p) continue;
        steer -= dz(p.axes[0] || 0);
        throttle = Math.max(throttle, (p.buttons[7] && p.buttons[7].value) || 0);
        brake = Math.max(brake, (p.buttons[6] && p.buttons[6].value) || 0);
        lookDx -= dz(p.axes[2] || 0) * 3; lookDy += dz(p.axes[3] || 0) * 2;
        behind = behind || !!(p.buttons[11] && p.buttons[11].pressed);
      }
      return { throttle, brake, steer: Math.max(-1, Math.min(1, steer)), look: { dx: lookDx, dy: lookDy, behind }, leave };
    },
    dispose() {
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
      window.removeEventListener('mouseup', onUp); window.removeEventListener('mousemove', onMove);
    },
  };
}

/** Simple arcade car: meters, seconds, radians. Top speed 25 m/s (about 56 mph, a city arterial). */
export const CAR = { length: 4.7, height: 1.45, top: 25, accel: 7, brake: 14, drag: 0.35, turn: 1.6 };
export function stepCar(c, inp, dt) {
  if (inp.throttle) c.speed += CAR.accel * inp.throttle * dt;
  if (inp.brake) c.speed -= (c.speed > 0.5 ? CAR.brake : CAR.accel * 0.5) * inp.brake * dt; // brake, then reverse slowly
  c.speed -= c.speed * CAR.drag * dt * (inp.throttle || inp.brake ? 0.2 : 1);
  c.speed = Math.max(-6, Math.min(CAR.top, c.speed));
  const grip = Math.min(1, Math.abs(c.speed) / 6);
  c.heading += inp.steer * CAR.turn * grip * dt * Math.sign(c.speed || 1);
  c.x += Math.sin(c.heading) * c.speed * dt; c.z += Math.cos(c.heading) * c.speed * dt;
  return c;
}
