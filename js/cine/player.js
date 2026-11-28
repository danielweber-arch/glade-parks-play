// Scene player: joins the clock, the rig (ShotMath port) and the stage.
// Test surface: window.gp.cine, merged into window.gp, never replaced.
// Skip is the Back action, Next is the Select action (locked decision 9).
// The input map has no Back or Select yet, so they fall back to UI Cancel and
// UI Submit. No new input action.
/* global THREE */
import { createClock } from './clock.js';
import { poseAt as rigPoseAt, subjectMap } from './rig.js';
import { createStage } from './stage.js';
import { loadInputMap, uiMap } from '../input/map.js';

const INPUT_MAP_URL = new URL('../../data/ui/input-map.json', import.meta.url).href;

function reduceMotion() {
  return document.documentElement.getAttribute('data-reduce-motion') === 'on';
}

function keysFor(map, names) {
  const ui = uiMap(map);
  for (const n of names) {
    const a = (ui.actions || []).find((x) => x.id === n);
    if (a) return a.keys || [];
  }
  return [];
}

// Probes for WebGL on a throwaway canvas and releases the probe context at once.
function webglOk() {
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('webgl2') || c.getContext('webgl');
    if (!ctx) return false;
    const lose = ctx.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

// No WebGL: a flat still frame. The clock, overlays and skip still run. Info level, not a warning:
// a machine without WebGL is a supported case, not a fault.
// Owner call 52: the still frame takes the playing list's mood ground color (light.ground in /data/cine/moods.json; the
// events.json defaultMood when the list names none, the same source DirectorData reads). FALLBACK_GROUND is only for when the mood data cannot be fetched.
const MOODS_URL = new URL('../../data/cine/moods.json', import.meta.url).href;
const EVENTS_URL = new URL('../../data/cine/events.json', import.meta.url).href;
const FALLBACK_GROUND = '#1d2228';
export async function moodGround(moodId) {
  try {
    const moods = await (await fetch(MOODS_URL)).json();
    let id = moodId;
    if (!id) {
      try { const d = (await (await fetch(EVENTS_URL)).json()).defaultMood; id = typeof d === 'string' ? d : d && d.value; } catch (e) { id = null; }
    }
    const m = (Array.isArray(moods) ? moods : []).find((x) => x.id === id);
    if (m && m.light && m.light.ground) return m.light.ground;
  } catch (e) { /* falls through */ }
  console.info('cine: mood data not available, the still frame uses the fallback color');
  return FALLBACK_GROUND;
}
function stillFrame(canvas, why, list) {
  canvas.style.background = FALLBACK_GROUND;
  moodGround(list && list.mood).then((c) => { canvas.style.background = c; canvas.dataset.still = c; });
  console.info('cine: no WebGL (' + why + '), the scene plays over a still frame');
}

// form: 'full' plays list.shots, 'stinger' plays list.stinger.shots.
// startPaused (dev and test use): the clock starts paused at 0, so a test can
// seek before any scene time runs, however slow the first frames are.
export async function createPlayer({ canvas, list, form = 'full', startPaused = false }) {
  const stinger = form === 'stinger' && list.stinger;
  const shots = stinger ? list.stinger.shots : list.shots;
  const seconds = stinger ? list.stinger.seconds : list.seconds;
  const playList = { set: list.set, shots };
  const subjects = subjectMap(list);
  const gl = webglOk();
  let stage = null;
  if (gl) {
    try { stage = createStage({ canvas, list }); } catch (e) { stage = null; stillFrame(canvas, 'the renderer did not start', list); }
  } else stillFrame(canvas, 'not available', list);

  const acting = (stinger ? [] : list.acting || []).slice().sort((a, b) => a.at - b.at);
  const clock = createClock({ shots, seconds, onEnd: () => window.dispatchEvent(new CustomEvent('gp-cine', { detail: { state: 'ended' } })) });

  const poseAt = (t, opts = {}) => rigPoseAt(playList, t, { subjects, reduceMotion: !!opts.reduceMotion });
  const pose = () => poseAt(clock.time(), { reduceMotion: reduceMotion() });

  function applyActing(t) {
    if (!stage) return;
    for (const a of stage.actors) {
      let cur = null;
      for (const c of acting) if (c.who === a.id && c.at <= t) cur = c;
      if (cur) a.setClip(cur.clip, cur.at);
    }
  }

  function resize() {
    if (!stage) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    stage.resize(w, h, window.devicePixelRatio || 1);
  }
  resize();
  window.addEventListener('resize', resize);

  let lastInfo = { calls: 0, triangles: 0, backing: [canvas.width, canvas.height] };
  // One requestAnimationFrame loop for the life of the scene. It keeps running while paused (a paused
  // scene still draws its frame) and stops at the end. Pause and resume never start a second loop.
  let running = false;
  let frames = 0;
  // N242: dispose stops the loop at once. It used to clear only the running flag; the frame already asked for
  // kept counting (and asking again) until the clock's skip grace ended, so a late player gained frames after dispose.
  let disposed = false;
  let rafId = 0;
  // Tick listeners (N220): the scene dressing follows the clock from this loop and from seek, so
  // a seek shows its overlay at once even when frames are slow (it no longer waits for its own rAF).
  const ticks = new Set();
  function tick() { const t = clock.time(); for (const f of ticks) f(t); }
  function frame() {
    rafId = 0;
    if (disposed) { running = false; return; }
    frames++;
    clock.update();
    const t = clock.time();
    if (stage) {
      try {
        applyActing(t);
        stage.render(pose(), t, reduceMotion());
        lastInfo = stage.info();
      } catch (e) { stage = null; stillFrame(canvas, 'the renderer stopped', list); }
    }
    tick();
    if (clock.state() !== 'ended') rafId = requestAnimationFrame(frame);
    else running = false;
  }
  function startLoop() {
    if (running || disposed) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  const map = await loadInputMap(INPUT_MAP_URL);
  const backKeys = keysFor(map, ['Back', 'Cancel']);
  const selectKeys = keysFor(map, ['Select', 'Submit']);
  function onKey(e) {
    if (e.repeat) return;
    if (backKeys.includes(e.code)) { e.preventDefault(); clock.skip(); }
    else if (selectKeys.includes(e.code)) { e.preventDefault(); clock.next(); }
  }
  window.addEventListener('keydown', onKey);

  // Warm up: the first render compiles every shader and can block for seconds
  // on a slow GPU. Do it before the clock starts so no scene time is lost.
  if (stage) {
    try { stage.render(poseAt(0, { reduceMotion: reduceMotion() }), 0, reduceMotion()); lastInfo = stage.info(); }
    catch (e) { stage = null; stillFrame(canvas, 'the first frame failed', list); }
  }
  clock.restart();
  if (startPaused) clock.pause();
  startLoop();

  const api = {
    state: () => clock.state(),
    time: () => clock.time(),
    pose,
    poseAt,
    skip: () => clock.skip(),
    next: () => clock.next(),
    pause: () => clock.pause(),
    resume: () => { clock.resume(); if (clock.state() !== 'ended') startLoop(); },
    seek: (t) => { clock.seek(t); tick(); },
    onTick: (fn) => { ticks.add(fn); return () => ticks.delete(fn); },
    info: () => ({
      webgl: gl && !!stage,
      drawCalls: lastInfo.calls,
      triangles: lastInfo.triangles,
      backing: lastInfo.backing.slice(),
      skipPressedAt: clock.skipPressedAt(),
      frames,
      loopRunning: running,
      three: typeof THREE !== 'undefined' ? THREE.REVISION : null,
    }),
    subject: (id) => (stage ? stage.subject(id) : null),
    // Removes the listeners, stops the loop and releases the renderer (P12.11b scene flow).
    dispose: () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      clock.skip();
      disposed = true;
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      ticks.clear();
      if (stage) { try { stage.dispose(); } catch (e) { /* already gone */ } stage = null; }
    },
  };
  window.gp = Object.assign(window.gp || {}, {});
  window.gp.cine = Object.assign(window.gp.cine || {}, api);
  return api;
}
