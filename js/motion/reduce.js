// The one module in the client that sets data-reduce-motion="on" on the root element (plan-cinematic
// appendix C). Inputs: the OS setting (prefers-reduced-motion, live changes included) and the
// gp.settings.reduceMotion key: auto (follow the OS, the default), on or off. Every other module reads the flag.
export const KEY = 'gp.settings.reduceMotion';
const VALUES = ['auto', 'on', 'off'];
const QUERY = '(prefers-reduced-motion: reduce)';

let mql = null;
try { mql = window.matchMedia ? window.matchMedia(QUERY) : null; } catch (e) { mql = null; }

// Last value set in this page, used only when storage cannot be read.
let memo = null;

export function getSetting() {
  let v = null, ok = true;
  try { v = window.localStorage.getItem(KEY); } catch (e) { ok = false; }
  if (!ok) v = memo;
  return VALUES.includes(v) ? v : 'auto';
}

export function osPrefersReduce() { return !!(mql && mql.matches); }

export function isReduced() { return document.documentElement.getAttribute('data-reduce-motion') === 'on'; }

// Called when the flag flips. moves.js registers finishAll here, so a move started under the old setting
// does not keep animating under the new one (reduce.js cannot import moves.js: moves.js imports this file).
const flipHooks = new Set();
export function onFlip(fn) { flipHooks.add(fn); return () => flipHooks.delete(fn); }

export function apply() {
  const s = getSetting();
  const on = s === 'on' || (s === 'auto' && osPrefersReduce());
  const root = document.documentElement;
  const was = isReduced();
  if (on) root.setAttribute('data-reduce-motion', 'on'); else root.removeAttribute('data-reduce-motion');
  if (was !== on) for (const f of Array.from(flipHooks)) f();
  return on;
}

export function setSetting(v) {
  if (!VALUES.includes(v)) v = 'auto';
  memo = v;
  try { window.localStorage.setItem(KEY, v); } catch (e) { /* storage blocked: memo keeps the choice for this page */ }
  return apply();
}

if (mql) {
  if (mql.addEventListener) mql.addEventListener('change', apply);
  else if (mql.addListener) mql.addListener(apply);
}
window.addEventListener('storage', e => { if (!e || e.key === KEY || e.key === null) apply(); });
apply();
