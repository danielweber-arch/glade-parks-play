// Scene dressing for the flow (P12.11b rest part A): the overlay (bars, cards, captions) and the
// audio cues over a playing scene, both driven by the player's clock. Data comes from data/cine
// (cards, moods, audio) by URLs relative to this file, so it works from Web/Client, Web/dist and the zip.
// Sound stays silent until the first press (createAudio unlocks then) and never carries a fact.
import { createOverlay } from './overlay/index.js';
import { createAudio } from './audio.js';

const url = (name) => new URL(`../../data/cine/${name}.json`, import.meta.url).href;
const getJson = (name) => fetch(url(name)).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// Test surface (N220): gp.cineDress = { errors, firstError, lastT, frames, audio(), cues() }, merged into window.gp,
// never replaced. A frame that throws keeps the scene playing; the error is counted, the first warned once.
const surface = { errors: 0, firstError: null, lastT: null, frames: 0 };
try { window.gp = Object.assign(window.gp || {}, { cineDress: surface }); } catch (e) { /* no window */ }
function caught(e) {
  surface.errors++;
  if (surface.firstError) return;
  surface.firstError = String((e && e.stack) || e);
  console.warn('scene dressing frame failed:', e);
}

let dataP = null;
export function loadDressData() {
  if (!dataP) {
    dataP = Promise.all([getJson('cards'), getJson('moods'), getJson('audio')]).then(([cards, moods, cues]) => ({
      cards: cards && typeof cards === 'object' ? cards : {},
      moods: Array.isArray(moods) ? moods : [],
      cues: Array.isArray(cues) ? cues : [],
    }));
  }
  return dataP;
}

// One audio player for the page, made at boot with no wait so the first press of the game unlocks
// it even while data/cine is still loading (part 2c). The cues are handed over when they arrive.
let audio = null;
export function pageAudio() {
  if (!audio) {
    audio = createAudio({ cues: [] });
    surface.audio = () => audio.state();
    surface.cues = () => audio.cues().length;
    surface.gains = () => audio.gains(); // null before the first press unlocks sound
    loadDressData().then((d) => audio.setCues(d.cues));
  }
  return audio;
}

// layer: the scene layer; clock: () => seconds (the player's clock); form: 'full' or 'stinger'.
// onTick(fn) -> unsubscribe: the player's tick (its frame loop and seek). Without it, an own rAF loop.
export async function createDress({ layer, list, form = 'full', clock, onTick = null }) {
  const [d, audio] = await Promise.all([loadDressData(), pageAudio()]);
  const overlay = createOverlay(layer, { cards: d.cards, moods: d.moods });
  overlay.load(list, form);
  const src = form === 'stinger' && list.stinger ? list.stinger : list;
  const cues = (src.audio || []).slice().sort((a, b) => a.at - b.at);
  const fired = new Set();
  const sounding = [];
  let live = true;

  function update(t) {
    overlay.update(t);
    cues.forEach((c, i) => {
      if (fired.has(i) || c.at > t) return;
      fired.add(i);
      const h = audio.play(c.cue);
      if (h) sounding.push(h);
    });
  }
  function step(t) {
    if (!live) return;
    try {
      surface.lastT = t;
      surface.frames++;
      update(t);
    } catch (e) { caught(e); } // the scene still plays without its dressing
  }
  let off = null;
  if (onTick) {
    off = onTick(step);
    // The time now, not the next frame's. A clock that throws here would leave the overlay over the
    // page with nothing to drive or end it (N220), so the dressing is taken down and counted.
    let t0;
    try { t0 = clock(); } catch (e) { caught(e); live = false; off(); try { overlay.destroy(); } catch (e2) { /* gone */ } }
    if (live) step(t0);
  } else {
    const frame = () => { if (!live) return; let t; try { t = clock(); } catch (e) { caught(e); } if (t !== undefined) step(t); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }

  return {
    overlay,
    audio,
    update,
    dispose() {
      if (!live) return;
      live = false;
      if (off) off();
      for (const h of sounding) { try { h.stop(); } catch (e) { /* already stopped */ } }
      try { overlay.destroy(); } catch (e) { /* already gone */ }
    },
  };
}
