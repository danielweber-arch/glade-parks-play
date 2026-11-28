// N271: fires window 'gp:quarter' ({detail: {year, quarter}}) when a reply's hud shows a different
// quarter from the last reply seen. It wraps every transport method, so host, wasm and stub replies
// all count, whichever screen asked (End the quarter on Home, a build card, the phone). The first
// reply only sets the baseline. A New Game or Load that moves the date fires too: listeners refresh.
import { METHODS } from './index.js';

export function hudQuarter(reply) {
  const h = reply && reply.hud;
  return h && Number.isFinite(h.year) && Number.isFinite(h.quarter) ? { year: h.year, quarter: h.quarter } : null;
}

export function watchQuarter(transport, target = window) {
  let last = null;
  const seen = (reply) => {
    const q = hudQuarter(reply);
    if (!q) return reply;
    const moved = last && (last.year !== q.year || last.quarter !== q.quarter);
    last = q;
    if (moved) target.dispatchEvent(new CustomEvent('gp:quarter', { detail: { year: q.year, quarter: q.quarter } }));
    return reply;
  };
  for (const m of METHODS) {
    const fn = transport[m];
    if (typeof fn !== 'function') continue;
    transport[m] = (...args) => Promise.resolve(fn.apply(transport, args)).then(seen);
  }
  return transport;
}
