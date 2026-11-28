// Web/Client entry: transport, router, input, scene flow. The client holds no game rules.
import { createTransport } from './transport/index.js';
import { watchQuarter } from './transport/quarter.js';
import { createRouter } from './screens/router.js';
import { loadInputMap, tunable } from './input/map.js';
import { createFocus } from './input/focus.js';
import { attachKeyboard } from './input/keyboard.js';
import { attachGamepad } from './input/gamepad.js';
import { createCineFlow, cineOff } from './cine/index.js';
import './motion/reduce.js'; // sets data-reduce-motion from the OS setting and the stored setting
import './build/entry.js'; // P7.7 part A: build mode (?build=1, #build or window.gpBuild())
import './city/entry.js'; // P7.9 city map and fast travel
import './drive/entry.js'; // P7.9 drive mode without the map
import './talk/index.js'; // P7.10 B: talk panel, opens on window 'gp-talk' { scene, offer, site }

async function loadWords() {
  try { const r = await fetch('text/shell.json'); return r.ok ? await r.json() : {}; } catch (e) { return {}; }
}

async function boot() {
  const words = await loadWords();
  const transport = watchQuarter(createTransport({ noAnswer: words.noAnswer })); // N271: gp:quarter at quarter end
  import('./log/index.js').then((m) => { window.gpLog = m.installSessionLog(transport); }); // P7.13 session log
  const panel = document.getElementById('panel');
  const status = document.querySelector('[data-status]');
  const stubTag = document.querySelector('[data-stub]');
  let flow = null;
  // One press in flight. A press made meanwhile is held (one slot, the newest wins) with the
  // screen it was made on. It is sent once the reply in flight has been drawn, but only if that
  // same screen is still up and still has the action: action ids ("1", "2") mean different things
  // on different screens, so a held press never lands on a new screen (owner call, P2-1).
  let inFlight = false;
  let held = null;
  // Owner call 55: the same action on the same screen again within guardMs of the last press that
  // was SENT is ignored (not sent, not held). Only send() stamps; an ignored press never moves it.
  let guardMs = 300; // Data/ui/input-map.json tunables.repeatGuardMs once the map loads
  let lastPress = null;
  function repeated(id, s) {
    if (s && s.kind === 'number') return false;
    const now = performance.now();
    const sid = s ? s.id : null;
    return !!lastPress && lastPress.id === id && lastPress.screen === sid && now - lastPress.at < guardMs;
  }
  const screenNow = () => { const r = router.last(); return r && r.screen ? r.screen : null; };
  async function send(id) {
    const s = screenNow();
    lastPress = { id, screen: s ? s.id : null, at: performance.now() }; // a held press is stamped when it goes
    inFlight = true;
    let reply;
    let fault = null;
    try { reply = await transport.act({ action: id }); } catch (e) { fault = e; reply = null; } finally { inFlight = false; }
    if (!reply) { // N208 item 6 / H17: the held press is dropped and the host error is shown, not swallowed
      held = null;
      if (fault) { console.error(fault); status.classList.add('bad'); status.textContent = words.noAnswer || 'The game is not answering.'; }
      return;
    }
    if (reply.hasGame && window.gpCreator && await window.gpCreator.needed()) { const made = await window.gpCreator.open(panel); if (made && made.ok) reply = made; }
    router.draw(reply);
    flushHeld();
  }
  // A held press waits out a scene that the reply started, then goes.
  function flushHeld() {
    if (held === null || inFlight || (flow && flow.playing())) return;
    const next = held; held = null;
    const s = screenNow();
    const fits = s && s.id === next.screen && (s.kind === 'number' || (s.actions || []).some((a) => a.id === next.id));
    if (!fits) return; // dropped: the screen it was pressed on is gone (a typed number counts on its own screen)
    send(next.id);
  }
  const router = createRouter({ panel, status, stubTag, words,
    onCine: (reply) => { if (flow) flow.offer(reply); },
    onPress: (id) => {
      if (flow && flow.playing()) return; // the panel is inert while a scene plays
      if (repeated(id, screenNow())) return;
      if (inFlight) { const s = screenNow(); held = { id, screen: s ? s.id : null }; return; }
      send(id);
    } });
  flow = createCineFlow({ transport, panel, draw: (r) => { router.draw(r); flushHeld(); }, off: cineOff(location.search) });
  const map = await loadInputMap();
  guardMs = tunable(map, 'repeatGuardMs', 300);
  if (map.fallback && words.mapFallback) console.warn(words.mapFallback);
  const focus = createFocus(panel);
  // While a scene plays, intents go to the scene, never to a screen button. The player reads the
  // keyboard itself (Back skips, Select is next), so keyboard intents are dropped here; controller
  // intents skip (cancel) or go to the next shot (submit).
  const keyFocus = { intent: (it) => {
    if (!flow.playing()) return focus.intent(it);
    if (it === 'cancel') flow.early(); // Back before the player is ready is remembered (N208 item 1)
  }, move: (s) => { if (!flow.playing()) focus.move(s); } };
  const padFocus = { intent: (it) => {
    if (!flow.playing()) return focus.intent(it);
    if (it === 'cancel') flow.skip(); else if (it === 'submit') flow.next();
  }, move: (s) => { if (!flow.playing()) focus.move(s); } };
  attachKeyboard(map, keyFocus);
  attachGamepad(map, padFocus, { onConnect: (on) => { status.textContent = on ? (words.padConnected || '') : (words.padGone || ''); } });
  window.gp = Object.assign(window.gp || {}, { transport, router, map, flow });
  router.draw(await transport.state());
  document.documentElement.setAttribute('data-ready', 'true');
}

boot();
