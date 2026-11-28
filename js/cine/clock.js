// Scene clock in real seconds: play, pause, next (jump to the next shot's at),
// and skip with a grace window. A skip pressed before the grace ends is
// remembered and fires when the grace ends. It is never dropped.
import { shotIndexAt } from './rig.js';

export const SKIP_GRACE_S = 0.4; // locked decision 9

export function createClock({ shots, seconds, grace = SKIP_GRACE_S, now, onEnd } = {}) {
  const wall = now || (() => performance.now() / 1000);
  let t0 = wall();
  let paused = false;
  let pausedAt = 0;
  let pausedTotal = 0;
  let offset = 0;
  let state = 'playing';
  let frozen = null;
  let pendingSkip = false;
  let skipPressedAt = null;
  let timer = null;
  // N240: the end no longer waits for a frame. On the host a software GPU can stall requestAnimationFrame for
  // seconds (3 frames in 12 s measured), so the natural end and a seek past the end never came. This timer
  // ends the scene on wall time; it is re-armed on every clock change and cleared on pause and end.
  let endTimer = null;

  function raw() {
    const w = paused ? pausedAt : wall();
    return w - t0 - pausedTotal + offset;
  }
  function time() {
    if (frozen !== null) return frozen;
    return Math.min(seconds, Math.max(0, raw()));
  }
  function end(at) {
    if (state === 'ended') return;
    frozen = at;
    state = 'ended';
    if (timer) clearTimeout(timer);
    timer = null;
    clearEnd();
    if (onEnd) onEnd(at);
  }
  // Call every frame. Fires a remembered skip and the natural end.
  function update() {
    if (state === 'ended') return state;
    const t = time();
    if (pendingSkip && t >= grace) end(Math.max(grace, t));
    else if (raw() >= seconds) end(seconds);
    return state;
  }
  function clearEnd() { if (endTimer) clearTimeout(endTimer); endTimer = null; }
  function armEnd() {
    clearEnd();
    if (paused || state === 'ended') return;
    const left = Math.max(0, seconds - raw());
    endTimer = setTimeout(() => { endTimer = null; if (update() !== 'ended') armEnd(); }, left * 1000 + 5);
  }
  function armGraceTimer() {
    if (timer || paused) return;
    const wait = Math.max(0, grace - time());
    timer = setTimeout(() => { timer = null; update(); }, wait * 1000);
  }
  function skip() {
    if (state === 'ended') return;
    if (skipPressedAt === null) skipPressedAt = time();
    if (time() >= grace) { end(time()); return; }
    pendingSkip = true;
    armGraceTimer();
  }
  function next() {
    if (state === 'ended') return;
    const t = time();
    const i = shotIndexAt(shots, t);
    const nx = i >= 0 && i + 1 < shots.length ? shots[i + 1] : null;
    if (!nx) { end(seconds); return; }
    offset += nx.at - t;
    if (update() !== 'ended') armEnd();
  }
  function pause() {
    if (paused || state === 'ended') return;
    paused = true;
    pausedAt = wall();
    state = 'paused';
    if (timer) { clearTimeout(timer); timer = null; }
    clearEnd();
  }
  function resume() {
    if (!paused || state === 'ended') return;
    pausedTotal += wall() - pausedAt;
    paused = false;
    state = 'playing';
    if (pendingSkip) armGraceTimer();
    if (update() !== 'ended') armEnd();
  }
  // Dev and test use: put the clock at scene time t.
  // A seek to or past the end ends the scene now, as its natural end (N240); it never waits for a frame.
  function seek(t) {
    if (state === 'ended') return;
    if (t >= seconds && !paused) { offset += seconds - time(); end(seconds); return; }
    offset += Math.min(seconds, Math.max(0, t)) - time();
    armEnd();
  }
  function restart() {
    t0 = wall(); paused = false; pausedTotal = 0; offset = 0; frozen = null;
    pendingSkip = false; skipPressedAt = null; state = 'playing';
    armEnd();
  }
  return {
    time, update, skip, next, pause, resume, seek, restart,
    state: () => state,
    skipPressedAt: () => skipPressedAt,
  };
}
