// Practice backend: a small in-memory game that follows the console flow with
// the contract 1 shapes. It is test data, not game rules: the only number that
// moves is a made-up cash figure that changes each quarter. Saves live in
// memory and are mirrored to localStorage inside try/catch.
// Owner call 39: Home is Build, Money, People, City, End the quarter, More. More holds Phone, Clock, Settings, Year and
// Life (Tools/play/Core/HomeGroups.cs). Owner call 83: the Phone is 5 main options plus More (Core/Screens2.cs).
const HOME = ['Build', 'Money', 'People', 'City', 'End the quarter', 'More'];
const MORE = ['Phone', 'Clock', 'Settings', 'Year', 'Life'];
const FOLDERS = ['Money', 'City', 'Goals', 'People', 'News', 'More'];
// Where Back goes from each stub screen with a game running (a leaf picked from a menu goes back to that menu).
const UP = { more: 'home', phone: 'more', settings: 'more', save: 'settings' };
const LEVELS = ['Easy', 'Normal', 'Tycoon'];
const WHY_NO_CONTINUE = 'No game to continue yet. Start a new one or load a save.'; // Data/ui/screens-text.json whyNoContinue

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const money = (n) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1000) + 'k');
const act = (label, i, back = false) => ({ id: back ? '0' : String(i), label, key: back ? '0' : String(i), back });
// Test switch: only with cine=1 in the page URL does a new game wait on a scene (dev/fixtures/first_lot.json),
// until FinishCutscene or SkipCutscene clears it. Without it the stub replies carry no cine key.
const SCENE_URL = new URL('../../dev/fixtures/first_lot.json', import.meta.url).href;
function sceneOn() { try { return new URLSearchParams(location.search).get('cine') === '1'; } catch (e) { return false; } }

export function createFixtureTransport({ storageKey = 'gp.stub.saves' } = {}) {
  let game = null;          // { year, quarter, difficulty, cash }
  let screenId = 'start';
  let pending = [];         // lines from the last press
  let slots = readSlots();
  let scene = null;         // a promise of the waiting shot list, only with cine=1
  let cineFault = null;     // test switch: 'fail' or 'reject' makes the next cutscene command fail once

  function readSlots() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeSlots() {
    try { localStorage.setItem(storageKey, JSON.stringify(slots)); } catch (e) { /* memory only */ }
  }
  const dateText = (g) => `Quarter ${g.quarter}, Year ${g.year}`;
  const ready = () => Object.keys(slots).map(Number).sort((a, b) => a - b);
  const newestReady = () => ready().reduce((best, n) => ((slots[n].savedAt || 0) > (slots[best].savedAt || 0) ? n : best), ready()[0]);

  function savesList() {
    const out = [];
    for (let n = 1; n <= 9; n++) {
      const s = slots[n];
      out.push({ slot: 'manual' + n, number: n, label: 'Slot ' + n, kind: 'Manual', status: s ? 'Ready' : 'Empty',
        summary: s ? `${dateText(s)}, ${s.difficulty}` : '' });
    }
    return out;
  }

  function screen() {
    const s = (title, kind, lines, actions, prompt = '') => ({ id: slug(title), title, kind, lines, prompt, actions });
    switch (screenId) {
      case 'start': { // owner call 2: same four title actions, ids and order as the host; Continue off with nothing to continue
        const can = !!game || ready().length > 0;
        return s('Start', 'menu', ['Welcome to Glade Parks.'], [{ ...act('Continue', 1), enabled: can, whyNot: can ? '' : WHY_NO_CONTINUE },
          act('New game', 2), act('Load', 3), act('Settings', 4)]);
      }
      case 'difficulty': return s('Difficulty', 'pick', ['Pick how hard the game plays.'], [...LEVELS.map((l, i) => act(l, i + 1)), act('Back', 0, true)]);
      case 'load': return s('Load', 'pick', ready().length ? ['Pick a save.'] : ['No saves yet.'],
        [...ready().map((n) => ({ ...act('Slot ' + n, n), id: 'slot' + n, key: String(n) })), act('Back', 0, true)]);
      case 'home': return s('Home', 'menu', [`Date: ${dateText(game)}`, `Company cash: ${money(game.cash)}`], HOME.map((l, i) => act(l, (i + 1) % 10)));
      case 'more': return s('More', 'menu', ['Pick a screen.'], [...MORE.map((l, i) => act(l, i + 1)), act('Back', 0, true)]);
      case 'phone': return s('Phone', 'menu', ['Pick a folder.'], [...FOLDERS.map((l, i) => act(l, i + 1)), act('Back', 0, true)]);
      case 'settings': return s('Settings', 'menu', ['Game settings.'], [act(game ? 'Save the game' : 'Load', 1), act('Back', 0, true)]);
      case 'save': return s('Save', 'pick', ['Pick a slot.'], [...savesList().map((v) => act(v.label, v.number)), act('Back', 0, true)]);
      default: return s(screenId.title, 'menu', [screenId.line], [act('Back', 0, true)]);
    }
  }

  function reply(ok = true, error = '') {
    const r = { contract: 1, ok, error, messages: ok ? pending : [], hasGame: !!game, stub: true, hud: null, screen: screen(), saves: savesList() };
    if (ok) r.screen.lines = [...pending, ...r.screen.lines];
    if (game) {
      r.hud = { year: game.year, quarter: game.quarter, difficulty: game.difficulty, rows: [
        { id: 'date', label: 'Date', text: dateText(game) },
        { id: 'cash', label: 'Company cash', text: money(game.cash), value: game.cash },
        { id: 'netWorth', label: 'Net worth', text: money(game.cash * 2), value: game.cash * 2 },
        { id: 'inbox', label: 'Inbox', text: '2 waiting', value: 2 } ] };
    }
    pending = [];
    if (!scene) return Promise.resolve(r);
    return scene.then((list) => (list ? { ...r, cine: { id: list.id || 'first_lot', play: 'full', list } } : r));
  }
  const fail = (line) => reply(false, line);

  function startGame(difficulty = 'Easy') {
    game = { year: 1, quarter: 1, difficulty, cash: 450000 };
    screenId = 'home';
    pending = ['A new game begins.'];
    scene = sceneOn() ? fetch(SCENE_URL).then((x) => (x.ok ? x.json() : null)).catch(() => null) : null;
  }
  function clearScene() {
    const f = cineFault; cineFault = null;
    if (f === 'reject') return Promise.reject(new Error('practice fault'));
    if (f === 'fail') return fail('That did not work. Try again.'); // the scene stays waiting
    scene = null; return reply();
  }
  function endQuarter() {
    if (!game) return fail('Start a game first.');
    game.quarter += 1;
    if (game.quarter > 4) { game.quarter = 1; game.year += 1; }
    game.cash += 25000 * game.quarter;
    screenId = 'home';
    pending = [`The quarter ends. It is now ${dateText(game)}.`];
    return reply();
  }
  function saveTo(n) {
    if (!game || !(n >= 1 && n <= 9)) return fail('That slot is not there.');
    slots[n] = { ...game, savedAt: Date.now() };
    writeSlots();
    pending = [`Saved to Slot ${n}.`];
    return reply();
  }
  function loadFrom(n) {
    if (!slots[n]) return fail('That slot is empty.');
    game = { ...slots[n] };
    scene = null; // N208 item 5: a stub save holds no waiting scene, so Load clears the one in memory
    screenId = 'home';
    pending = [`Loaded Slot ${n}.`];
    return reply();
  }

  function press(id) {
    const a = screen().actions.find((x) => x.id === id);
    if (!a) return fail('That choice is not on this screen.');
    if (a.back) { screenId = game ? (typeof screenId === 'string' ? UP[screenId] || 'home' : screenId.up || 'home') : 'start'; return reply(); }
    switch (screenId) {
      case 'start':
        if (id === '1') { // Continue: the running game, else the newest save, else the reason
          if (game) { screenId = 'home'; return reply(); }
          const r = ready();
          return r.length ? loadFrom(newestReady()) : fail(WHY_NO_CONTINUE);
        }
        screenId = { 2: 'difficulty', 3: 'load', 4: 'settings' }[id]; return reply();
      case 'difficulty': startGame(a.label); return reply();
      case 'load': return loadFrom(Number(id.replace('slot', '')));
      case 'save': { const r = saveTo(Number(id)); screenId = 'home'; return r.then((x) => ({ ...x, screen: screen() })); }
      case 'settings': screenId = game ? 'save' : 'load'; return reply();
      case 'home':
        if (a.label === 'End the quarter') return endQuarter();
        if (a.label === 'More') { screenId = 'more'; return reply(); }
        screenId = { title: a.label, line: 'Practice data has nothing here yet.', up: 'home' }; return reply();
      case 'more':
        if (a.label === 'Phone') { screenId = 'phone'; return reply(); }
        if (a.label === 'Settings') { screenId = 'settings'; return reply(); }
        screenId = { title: a.label, line: 'Practice data has nothing here yet.', up: 'more' }; return reply();
      case 'phone': screenId = { title: a.label, line: 'Practice data has nothing in this folder yet.', up: 'phone' }; return reply();
      default: return reply();
    }
  }

  return {
    name: 'stub',
    state: () => reply(),
    newGame: (o = {}) => { startGame(LEVELS.includes(o.difficulty) ? o.difficulty : 'Easy'); return reply(); },
    load: (o = {}) => loadFrom(Number(String(o.slot || '').replace('manual', ''))),
    save: (o = {}) => saveTo(Number(o.slot)),
    endQuarter,
    command: (o = {}) => (o.name === 'FinishCutscene' || o.name === 'SkipCutscene' ? clearScene() : o.name === 'end-quarter' ? endQuarter() : (game ? (screenId = 'home', reply()) : fail('Start a game first.'))),
    act: (o = {}) => press(String(o.action)),
    // Test switch (specs only): the next FinishCutscene or SkipCutscene fails ('fail') or rejects ('reject').
    failNextCutscene: (kind = 'fail') => { cineFault = kind === 'reject' ? 'reject' : 'fail'; },
  };
}
