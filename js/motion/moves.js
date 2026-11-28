// Interruptible moves. Only transform and opacity animate. Input is never blocked: nothing here sets
// pointer-events or swallows events. A press (pointer or key) mid move finishes every running move at once,
// and the press still reaches its target because the listener is passive and never stops it.
import { tokens } from './tokens.js';
import { isReduced, onFlip } from './reduce.js';

const finishers = new Set();
// The close each element is waiting on. A later open or close replaces it, so a stale leave never hides a reopened panel.
const pendingClose = new WeakMap();

function cancelPendingClose(el) {
  const a = pendingClose.get(el);
  if (!a) return;
  pendingClose.delete(el);
  try { a.cancel(); } catch (e) { /* already gone */ }
}

export function isMotionAnimation(a) {
  const id = a.id || '';
  const name = a.animationName || '';
  return id.startsWith('motion-') || name.startsWith('motion-');
}

/** Finishes every running motion animation and count up now. Returns how many it finished. */
export function finishAll() {
  let n = 0;
  const list = document.getAnimations ? document.getAnimations() : [];
  for (const a of list) {
    if (!isMotionAnimation(a) || a.playState === 'finished') continue;
    try { a.finish(); n++; } catch (e) { /* an infinite animation cannot finish; none are made here */ }
  }
  for (const f of Array.from(finishers)) { f(); n++; }
  return n;
}

/** Count ups and other timed work register a finisher so a press completes them too. */
export function addFinisher(fn) { finishers.add(fn); return () => finishers.delete(fn); }

function play(el, frames, timing, id) {
  return el.animate(frames, Object.assign({ fill: 'both' }, timing, { id }));
}

function fade(el, inward) {
  const t = tokens();
  return play(el, inward ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
    { duration: t.reduceFade, easing: 'linear' }, inward ? 'motion-fade-in' : 'motion-fade-out');
}

/** Slide 12 px and fade in, panel open time, ease out. Reduced motion: a plain fade. */
export function enter(el, opts = {}) {
  cancelPendingClose(el);
  if (isReduced()) return fade(el, true);
  const t = tokens();
  const large = !!opts.large;
  return play(el, [{ opacity: 0, transform: `translateY(${t.slide}px)` }, { opacity: 1, transform: 'none' }],
    { duration: large ? t.largeMove : t.panelOpen, easing: t.easeOut, delay: opts.delay || 0 }, large ? 'motion-enter-large' : 'motion-enter');
}

/** Slide and fade out, panel close time, ease in. Reduced motion: a plain fade. */
export function leave(el) {
  if (isReduced()) return fade(el, false);
  const t = tokens();
  return play(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${t.slide}px)` }],
    { duration: t.panelClose, easing: t.easeIn }, 'motion-leave');
}

/** Opens a panel: shows it, then plays enter. */
export function open(el, opts) { cancelPendingClose(el); el.hidden = false; return enter(el, opts); }

/** Closes a panel: plays leave, then hides it (also when a press finishes the move early). */
export function close(el) {
  cancelPendingClose(el);
  const a = leave(el);
  pendingClose.set(el, a);
  a.finished.then(() => {
    if (pendingClose.get(el) === a) { el.hidden = true; pendingClose.delete(el); }
    a.cancel();
  }, () => {});
  return a;
}

// A held key repeats, and a bare Shift, Control, Alt or Meta is not a press the player meant for the screen.
const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'OS'];
function onPress() { finishAll(); }
function onKey(e) { if (e.repeat || MODIFIER_KEYS.includes(e.key)) return; finishAll(); }
if (!window.__gpMotionPressHooked) {
  window.__gpMotionPressHooked = true;
  document.addEventListener('pointerdown', onPress, { capture: true, passive: true });
  document.addEventListener('keydown', onKey, { capture: true, passive: true });
  onFlip(finishAll);
}
