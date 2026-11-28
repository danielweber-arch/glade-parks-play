// Money count up over the token time on Easy and Normal. Tycoon, and reduced motion, show the final number at once.
// A press finishes it at once (moves.js finishAll).
import { tokens } from './tokens.js';
import { isReduced } from './reduce.js';
import { addFinisher } from './moves.js';

const COUNTS_ON = ['easy', 'normal'];

export function countsUp(difficulty) {
  return !isReduced() && COUNTS_ON.includes(String(difficulty || 'normal').toLowerCase());
}

/** Shows from..to in el.textContent. Returns a promise that resolves when the final number shows. */
export function countUp(el, from, to, opts = {}) {
  const format = opts.format || (n => String(Math.round(n)));
  if (!countsUp(opts.difficulty)) { el.textContent = format(to); return Promise.resolve(to); }
  const dur = tokens().countUp;
  return new Promise(resolve => {
    let done = false, start = null;
    const end = () => { if (done) return; done = true; drop(); el.textContent = format(to); resolve(to); };
    const drop = addFinisher(end);
    const step = now => {
      if (done) return;
      if (start === null) start = now;
      const k = Math.min(1, (now - start) / dur);
      if (k >= 1) { end(); return; }
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = format(from + (to - from) * eased);
      requestAnimationFrame(step);
    };
    el.textContent = format(from);
    requestAnimationFrame(step);
  });
}
