// N309: controller input for the talk panel. Polls navigator.getGamepads() on animation frames and fires on a press
// (edge), not while held. Standard mapping: buttons 12/13 d-pad up/down, 0 = A, 1 = B; axis 1 is the left stick.
const DEAD = 0.5;

export function readPad(pads) {
  const list = Array.from(pads || []).filter(Boolean);
  const p = list[0];
  if (!p) return { up: false, down: false, a: false, b: false };
  const b = (i) => !!(p.buttons && p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > DEAD));
  const y = p.axes && p.axes.length > 1 ? p.axes[1] : 0;
  return { up: b(12) || y < -DEAD, down: b(13) || y > DEAD, a: b(0), b: b(1) };
}

export function padNav({ move, pick, back }) {
  let last = { up: false, down: false, a: false, b: false }, raf = 0, live = true;
  const tick = () => {
    if (!live) return;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const now = readPad(pads);
    if (now.up && !last.up) move(-1);
    if (now.down && !last.down) move(1);
    if (now.a && !last.a) pick();
    if (now.b && !last.b) back();
    last = now;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop() { live = false; cancelAnimationFrame(raf); } };
}
