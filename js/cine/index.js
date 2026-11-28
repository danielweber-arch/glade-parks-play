// Scene flow (P12.11b core): plays the scene a Reply says is waiting, over the panel.
// One scene at a time. Natural end sends FinishCutscene once, a skip sends SkipCutscene once;
// then the layer goes, the player is disposed and the command's Reply goes back to the router.
// A failed command still removes the layer: a scene must never trap the player.
// ?cine=0 in the page URL turns the flow off (test switch): nothing plays, no command is sent.
// N337 (r53 e1): a story choice scene (block with story) opens the talk panel instead and ends through AnswerStoryScene. It
// has no Skip, the Skip/Back key does nothing, and Scenes Off or Short still shows its replies (never SkipCutscene).
import { createPlayer } from './player.js';
import { createDress, pageAudio } from './dress.js';
import { getSetting } from './settings.js';
import { showNote, cashOf } from './note.js';
import { openTalk } from '../talk/index.js';

const CARDS_URL = new URL('../../data/cine/cards.json', import.meta.url).href;

export function cineOff(search) {
  // The last cine= wins: a test page adds ?cine=0 after the mode's own cine=1 (stub), and get() read the first.
  try { const v = new URLSearchParams(search || '').getAll('cine'); return v[v.length - 1] === '0'; } catch (e) { return false; }
}

async function skipWord() {
  try { const c = await (await fetch(CARDS_URL)).json(); return (c && c.hints && c.hints.skip) || ''; } catch (e) { return ''; }
}

export function createCineFlow({ transport, panel, draw, off = false }) {
  let playing = null;   // { id, api, layer, sent }
  let doneId = null;    // the scene just ended; not played again until a Reply arrives without it
  let cashText = '';    // the latest Reply's HUD cash row text: the cash row in the scene lower bar (N241)
  const root = document.documentElement;

  function focusFirst() {
    const first = panel.querySelector('[data-number]') || panel.querySelector('[data-action]:not([aria-disabled="true"])') || panel.querySelector('[data-action]');
    if (first) first.focus();
  }

  function buildLayer(label) {
    const layer = document.createElement('div');
    layer.className = 'cine-flow';
    layer.setAttribute('data-cine-layer', '');
    const canvas = document.createElement('canvas');
    canvas.className = 'cine-flow-canvas';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cine-flow-skip';
    btn.setAttribute('data-cine-skip', '');
    btn.textContent = label;
    if (!label) btn.hidden = true;
    layer.append(canvas, btn);
    return { layer, canvas, btn };
  }

  async function finish(p) {
    if (p.sent) return;
    p.sent = true;
    const info = p.api ? p.api.info() : {};
    const skipped = p.early || (info.skipPressedAt !== null && info.skipPressedAt !== undefined);
    const name = skipped ? 'SkipCutscene' : 'FinishCutscene';
    window.removeEventListener('gp-cine', p.onEnd);
    let reply = null;
    try { reply = await transport.command({ name, args: {} }); } catch (e) { reply = null; }
    teardown(p);
    doneId = p.id;
    if (reply) draw(reply); // draws, and offers the next waiting scene
    if (!reply || !reply.ok) focusFirst();
  }

  function teardown(p) {
    p.gone = true; // a player that resolves after this is disposed at once (N208 item 1)
    try { if (p.api && p.api.dispose) p.api.dispose(); } catch (e) { /* the layer still goes */ }
    try { if (p.dress) p.dress.dispose(); } catch (e) { /* the layer still goes */ }
    p.layer.remove();
    panel.inert = false;
    root.removeAttribute('data-cine');
    if (playing === p) playing = null;
  }

  // N241: every Reply carries the HUD; its cash row is the scene's cash row, so a money-moving reply
  // during a scene updates the lower bar at once.
  function takeCash(reply) {
    const row = cashOf(reply);
    if (!row) return;
    cashText = String(row.text || '');
    const d = playing && playing.dress;
    if (d) { d.overlay.setCash(cashText); try { d.update(playing.api.time()); } catch (e) { /* next tick draws it */ } }
  }

  async function offer(reply) {
    if (off || !reply || !reply.ok) return;
    takeCash(reply);
    const c = reply.cine;
    if (!c || (!c.list && !c.story)) { doneId = null; return; }
    // N208 item 4: doneId only blocks the reply that still carries the scene just finished. The host
    // queue clears that scene before it offers the next one, and list ids are scene keys, so the same
    // id twice in a row is one scene seen twice (a reply drawn again), never two queued scenes.
    if (playing || c.id === doneId) return;
    if (c.story) { story(c); return; }
    const scenes = getSetting('scenes');
    if (scenes === 'off') { // Scenes Off: no scene, one line plus the cash row (N238), and one SkipCutscene
      showNote(reply);
      const p = { id: c.id, api: null, layer: document.createElement('div'), sent: false, onEnd: null, early: true, gone: false };
      playing = p;
      finish(p);
      return;
    }
    // N208 item 9: a reply that asks for play 'stinger' plays the stinger form, whatever the setting.
    const form = (c.play === 'stinger' || scenes === 'short') && c.list.stinger ? 'stinger' : 'full';
    const { layer, canvas, btn } = buildLayer('');
    layer.setAttribute('data-cine-form', form);
    layer.setAttribute('data-cine-id', String(c.id));
    // early: a Back or Skip pressed before the player exists, applied once it does (N208 item 1).
    const p = { id: c.id, api: null, layer, sent: false, onEnd: null, early: false, gone: false };
    playing = p;
    root.setAttribute('data-cine', 'playing');
    panel.inert = true;
    document.body.append(layer);
    p.onEnd = (e) => { if (e.detail && e.detail.state === 'ended' && playing === p) finish(p); };
    window.addEventListener('gp-cine', p.onEnd);
    btn.addEventListener('click', () => skipScene(p));
    skipWord().then((w) => { btn.textContent = w; btn.hidden = !w; });
    let api = null;
    try {
      api = await createPlayer({ canvas, list: c.list, form });
    } catch (e) {
      // The player could not start: count it as a skip so the game moves on.
      p.api = { info: () => ({ skipPressedAt: 0 }), dispose: () => {} };
      finish(p);
      return;
    }
    if (p.gone) { try { api.dispose(); } catch (e) { /* already gone */ } return; } // ended or torn down meanwhile
    p.api = api;
    if (p.early) api.skip(); // the remembered press: the clock ends the scene once (after its grace)
    dress(p, c.list, form);
  }

  // Bars, cards, captions and sound over the scene, on the player's clock. A dressing that fails
  // to load leaves the scene playing bare.
  async function dress(p, list, form) {
    let d = null;
    try { d = await createDress({ layer: p.layer, list, form, clock: () => p.api.time(), onTick: p.api.onTick ? (fn) => p.api.onTick(fn) : null }); } catch (e) { return; }
    if (p.gone) { d.dispose(); return; }
    p.dress = d;
    d.overlay.setCash(cashText);
    try { d.update(p.api.time()); } catch (e) { /* next tick draws it */ }
    p.layer.append(p.layer.querySelector('[data-cine-skip]')); // the Skip button stays on top
  }

  // N337: the story choice scene in the talk panel. The panel stays inert behind it; the reply drawn offers the next scene.
  function story(c) {
    const p = { id: c.id, api: null, layer: document.createElement('div'), sent: false, onEnd: null, early: false, gone: false, story: true };
    playing = p;
    root.setAttribute('data-cine', 'story');
    panel.inert = true;
    openTalk({ scene: c.story, site: c.site || '', story: true, send: (cmd) => transport.command(cmd), onDone: (reply) => {
      p.sent = true;
      teardown(p);
      doneId = reply && reply.ok ? p.id : null;
      if (reply) draw(reply); // draws, and offers the next waiting scene
      if (!reply || !reply.ok) focusFirst();
    } });
  }

  // A Back or Skip press. Before the player exists it is remembered, once. A story choice scene ignores it (N337).
  function skipScene(p) {
    if (!p || p.sent || p.gone || p.story) return;
    if (p.api) p.api.skip(); else p.early = true;
  }

  if (!off) pageAudio(); // made at boot so the first press of the game unlocks sound

  return {
    offer,
    dress: () => (playing && playing.dress) || null,
    playing: () => !!playing,
    skip: () => skipScene(playing),
    // Keyboard Back while the player is not ready yet (it reads the keyboard itself once it is).
    early: () => { if (playing && !playing.api) skipScene(playing); },
    next: () => { if (playing && playing.api && playing.api.next) playing.api.next(); },
  };
}
