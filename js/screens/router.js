// Draws whichever screen the last Reply holds and fills the status line.
import { drawStart } from './start.js';
import { drawHome } from './home.js';
import { drawPhone } from './phone.js';
import { drawGeneric } from './generic.js';
import { drawSettings, settingsEntry } from './settings.js';

const ENTRY = new Set(['start', 'home']); // client side Sound and scenes entry (P12.11b part B)

const DRAW = { start: drawStart, home: drawHome, phone: drawPhone };

export function createRouter({ panel, status, stubTag, words, onPress, onCine }) {
  let last = null;
  let open = null; // the Sound and scenes screen, while it is up
  let drawn = 0; // N418 (r61 m4): counts drawn replies; a state read that started before a newer draw is dropped
  function draw(reply) {
    if (!reply) return;
    status.classList.toggle('bad', !reply.ok);
    status.textContent = !reply.ok ? reply.error : (reply.messages || []).join(' ');
    stubTag.hidden = !reply.stub;
    stubTag.textContent = words.practiceData || 'Practice data';
    if (!reply.ok) return; // nothing changed: keep the old screen; a failed reply never starts or stops a scene
    if (!reply.screen) { if (onCine) onCine(reply); return; }
    last = reply;
    open = null;
    drawn++;
    paint(reply);
    // The screen is drawn first, then the scene flow sees the reply's cine block (P12.11b).
    if (onCine) onCine(reply);
    if (reply.screen.talk) openTalk(reply.screen.talk);
  }
  // B1 (N355): the console asked for a talk (ConsoleBridge serves it once). Finishing sends FinishTalk through the
  // transport, whose reply carries the console back at Home; a talk backed out of (no reply) redraws from state.
  let talking = false;
  function openTalk(t) {
    const gp = window.gp || {}; const tr = gp.transport;
    if (talking || !window.gpTalk || !tr) return;
    talking = true;
    window.gpTalk.open({ scene: t.scene, offer: t.offer, site: t.site || '', send: (cmd) => tr.command(cmd),
      onDone: async (result) => {
        talking = false;
        if (result && result.screen) draw(result); // a refused finish keeps the screen and shows why
        else redraw();
      } });
  }
  async function redraw() {
    const tr = (window.gp || {}).transport;
    if (!tr) return;
    const at = drawn;
    try {
      const r = await tr.state();
      if (drawn !== at) return; // N418: a newer reply was drawn while this read was out; never paint the older screen over it
      draw(r);
    } catch (e) { console.error(e); }
  }
  // Contract with the 3D build slot (g3): it fires gp-redraw when it closes.
  window.addEventListener('gp-redraw', () => { redraw(); });
  // Draws a Sim screen without offering its scene again (Back from Sound and scenes uses it too).
  function paint(reply, focusSel) {
    const s = reply.screen;
    panel.replaceChildren();
    panel.setAttribute('data-screen', s.id);
    panel.setAttribute('data-kind', s.kind);
    (DRAW[s.id] || drawGeneric)(panel, reply, onPress, words);
    if (ENTRY.has(s.id)) panel.prepend(settingsEntry(words, openSettings));
    // Focus the first action that can be pressed (owner call 2: Start's Continue is off with nothing to continue).
    // The client entry is never focused first, so Enter on a fresh screen does what it did before.
    const sim = '[data-action]:not([data-client])';
    const first = (focusSel && panel.querySelector(focusSel)) || panel.querySelector('[data-number]')
      || panel.querySelector(sim + ':not([aria-disabled="true"])') || panel.querySelector(sim);
    // r61: a redraw behind an open build, drive, city map or scene view never takes the keys from it (the SetBuildMode
    // reply used to land after the build canvas took focus, so arrow keys stopped moving the cursor).
    const a = document.activeElement;
    if (a && a.closest && a.closest('[data-build],[data-drive],[data-city],[data-cine-layer]')) return;
    if (first) first.focus();
  }
  function openSettings() {
    if (!last || !last.screen) return;
    open = { from: last };
    drawSettings(panel, { words, onBack: closeSettings });
  }
  function closeSettings() {
    if (!open) return;
    const from = open.from; open = null;
    paint(from, '[data-client="settings"]');
  }
  return { draw, redraw, last: () => last, openSettings, closeSettings, settingsOpen: () => !!open };
}
