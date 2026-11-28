// P5.6 (N310): the developer and company creator, shown on New Game before the opening scene. Choices and their words come
// from the host (/api/creator/options, read from Data/story/character.json); only labels are shown. Create runs
// CreateDeveloper through /api/creator/create. Keyboard (Tab, arrows, Enter) and mouse both work on every field.
// N438: a live low poly figure (js/figure/preview.js) beside the choices redraws on every pick, and shows a choice while it
// is hovered or focused; leaving returns to the picked look. Skin tone buttons carry a color swatch from Data.
import { loadLook } from '../figure/figure.js';
import { mountPreview } from '../figure/preview.js';

async function getJson(url, init) { const r = await fetch(url, init); return r.ok ? r.json() : null; }

function field(f, pick, live) {
  const box = document.createElement('fieldset');
  box.className = 'creator-field';
  box.setAttribute('data-field', f.key);
  const legend = document.createElement('legend');
  legend.textContent = f.label;
  const group = document.createElement('div');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', f.label);
  const buttons = f.choices.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.label;
    b.setAttribute('role', 'radio');
    b.setAttribute('data-choice', String(i));
    b.setAttribute('data-client', 'creator-' + f.key); // N351: the pad moves and presses it (js/input/focus.js)
    b.addEventListener('click', () => choose(i));
    const hex = live && live.swatch(f.key, c.id);
    if (hex) { const sw = document.createElement('span'); sw.className = 'creator-swatch'; sw.setAttribute('aria-hidden', 'true'); sw.style.backgroundColor = hex; b.prepend(sw); }
    if (live) {
      b.addEventListener('pointerenter', () => live.over('hover', f.key, c.id));
      b.addEventListener('pointerleave', () => live.over('hover', f.key, null));
      b.addEventListener('focus', () => live.over('focus', f.key, c.id));
      b.addEventListener('blur', () => live.over('focus', f.key, null));
    }
    return b;
  });
  function choose(i) {
    buttons.forEach((b, k) => { b.setAttribute('aria-checked', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
    pick(f.key, f.choices[i].id);
  }
  group.addEventListener('keydown', (e) => {
    const at = buttons.indexOf(document.activeElement);
    if (at < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault(); e.stopPropagation();
    const next = (at + step + buttons.length) % buttons.length;
    choose(next); buttons[next].focus();
  });
  group.append(...buttons);
  box.append(legend, group);
  choose(0);
  return box;
}

// N351: a name field a controller can fill. Left and Right (keys, or the pad on the two arrow buttons) cycle the
// suggested names from the host (Data/people/names.json); Enter confirms and moves on. Typing still works: once the
// player types their own name, Left and Right move the caret again.
function textField(key, label, max, suggestions) {
  const wrap = document.createElement('div');
  wrap.className = 'creator-text';
  const span = document.createElement('label');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'text'; input.maxLength = max; input.autocomplete = 'off';
  input.id = 'creator-' + key; span.htmlFor = input.id;
  input.setAttribute('data-field', key);
  const list = (suggestions || []).filter((n) => n && n.length <= max);
  let at = 0;
  if (list.length) input.value = list[0];
  const suggested = () => !input.value || list.includes(input.value);
  function cycle(step) { if (!list.length) return; at = (at + step + list.length) % list.length; input.value = list[at]; }
  const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '\u2039';
  const next = document.createElement('button'); next.type = 'button'; next.textContent = '\u203a';
  prev.setAttribute('aria-label', label + ': the name before'); next.setAttribute('aria-label', label + ': the next name');
  [prev, next].forEach((b) => { b.tabIndex = -1; /* Tab goes name to company as before; the pad still reaches them */ b.setAttribute('data-client', 'creator-' + key); b.setAttribute('data-cycle', b === prev ? '-1' : '1'); });
  prev.addEventListener('click', () => cycle(-1));
  next.addEventListener('click', () => cycle(1));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return; // Escape goes on to Cancel
    e.stopPropagation(); // typed letters never reach the game keys
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && suggested() && list.length) { e.preventDefault(); cycle(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  const row = document.createElement('div'); row.className = 'creator-name-row';
  row.append(prev, input, next);
  wrap.append(span, row);
  return { wrap, input };
}

// Opens the creator in the panel. Resolves with the host reply once the developer is made.
export async function openCreator(panel) {
  const [opts, palette] = await Promise.all([getJson('/api/creator/options'), loadLook()]);
  if (!opts) return null;
  const picked = {};
  const preview = mountPreview(palette); // null without WebGL or the look data: the creator works as before
  const live = liveLook(preview, palette, picked);
  // N425 (r61 m4): #panel names the creator while it is up, and gets the screen it had back when it closes.
  const was = panel.getAttribute('data-screen');
  const done = (resolve, v) => { if (panel.getAttribute('data-screen') === 'creator') { if (was == null) panel.removeAttribute('data-screen'); else panel.setAttribute('data-screen', was); } resolve(v); };
  return new Promise((resolve) => {
    const form = document.createElement('form');
    form.className = 'creator';
    form.setAttribute('data-creator', 'true');
    form.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); }); // Enter, Space and arrows stay in the creator (the game keys on window would eat them); Escape reaches Cancel
    const h = document.createElement('h1'); h.textContent = 'Who runs this company?';
    const name = textField('name', 'Your name', opts.nameMax, opts.names);
    const company = textField('company', 'Company name', opts.companyMax, opts.companies);
    const fields = opts.fields.map((f) => field(f, (k, v) => { picked[k] = v; live.redraw(); }, live));
    const note = document.createElement('p'); note.setAttribute('data-note', ''); note.setAttribute('aria-live', 'polite');
    const go = document.createElement('button'); go.type = 'submit'; go.textContent = 'Start my company'; go.setAttribute('data-create', ''); go.setAttribute('data-client', 'creator-create');
    // Cancel (Escape, pad Back) presses data-back through js/input/focus.js: the creator closes with no profile and the
    // game's reply is drawn; it opens again on the next press while the game still needs a developer.
    // N419: 'Back' here is a last-resort string; the word lives in Data/ui/lexicon.json (concept "back").
    const back = document.createElement('button'); back.type = 'button'; back.textContent = 'Back'; back.setAttribute('data-back', 'true'); back.setAttribute('data-client', 'creator-back');
    back.addEventListener('click', () => { live.close(); form.remove(); done(resolve, null); });
    const row = document.createElement('div'); row.className = 'creator-buttons'; row.append(go, back); // N347: two buttons side by side
    if (preview) form.classList.add('creator-has-preview');
    if (preview) preview.el.style.setProperty('--preview-rows', String(fields.length + 5)); // spans the choice rows, no empty gaps
    form.append(h, ...(preview ? [preview.el] : []), name.wrap, company.wrap, note, row, ...fields); // N438: the preview holds nothing tabbable, so Tab order is unchanged. N351: Start sits right after the names, so a pad reaches it in a few presses; the look choices follow
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.assign({ name: name.input.value, company: company.input.value }, picked);
      const reply = await getJson('/api/creator/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!reply || !reply.ok) { note.textContent = (reply && reply.error) || 'The game is not answering.'; return; }
      live.close();
      form.remove();
      done(resolve, reply);
    });
    name.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); company.input.focus(); } });
    panel.replaceChildren(form);
    panel.setAttribute('data-screen', 'creator');
    name.input.focus();
  });
}

// Field keys from /api/creator/options to the figure's look keys.
const LOOK_KEY = { body: 'body', skinTone: 'skin', hair: 'hair', face: 'face' };

// Picked look plus the choice under focus, then under the pointer (the pointer wins while it is over a choice).
function liveLook(preview, palette, picked) {
  const temp = { focus: null, hover: null };
  const drawn = () => {
    const look = {};
    Object.keys(LOOK_KEY).forEach((k) => { look[LOOK_KEY[k]] = picked[k] || null; });
    ['focus', 'hover'].forEach((kind) => { const t = temp[kind]; if (t && LOOK_KEY[t.key]) look[LOOK_KEY[t.key]] = t.id; });
    return look;
  };
  const redraw = () => { if (preview) preview.show(drawn()); };
  if (preview) {
    const fig = preview.figure.userData;
    window.gpCreatorPreview = { owner: preview.el, look: () => Object.assign({}, fig.look), height: () => fig.height, skinHex: () => fig.skinHex, rotation: () => preview.rotation() };
  }
  return {
    redraw,
    over(kind, key, id) { if (!LOOK_KEY[key]) return; temp[kind] = id ? { key, id } : (temp[kind] && temp[kind].key === key ? null : temp[kind]); redraw(); },
    swatch(key, id) { const e = key === 'skinTone' && palette && palette.skin && palette.skin[id]; return e ? e.value : null; },
    close() { if (preview) preview.dispose(); },
  };
}

// True when the running game still needs a developer (turn 0, no profile saved).
export async function creatorNeeded() {
  const s = await getJson('/api/creator/status');
  return !!(s && s.needed);
}

window.gpCreator = { open: openCreator, needed: creatorNeeded };
