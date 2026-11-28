import { el, linesList, actionList, withoutHud } from './common.js';

// N437 sunny look: Home groups (color + glyph) from Data/ui/home-look.json, fetched once at module load. The first draw
// never waits: it uses the index order below, then applyLook patches the open Home when the file arrives.
const FALLBACK_ORDER = ['build', 'money', 'people', 'city', 'end', 'more'];
let look = null; // { order: [...], byLabel: Map(label -> { group, glyph }) }
export const lookReady = fetch(new URL('../../data/ui/home-look.json', import.meta.url).href)
  .then(r => (r.ok ? r.json() : null))
  .then(j => {
    if (!j || !j.groups) return null;
    const byLabel = new Map();
    for (const [group, e] of Object.entries(j.groups)) {
      const v = (e && e.value) || {};
      for (const l of v.labels || []) byLabel.set(String(l).trim().toLowerCase(), { group, glyph: v.glyph || '' });
    }
    look = { order: (j.order && j.order.value) || FALLBACK_ORDER, byLabel };
    const open = document.querySelector('#panel[data-screen="home"] .actions.grid');
    if (open) applyLook(open);
    return look;
  })
  .catch(e => { console.error('[home] look', e); return null; });

function applyLook(actions) {
  const order = (look && look.order) || FALLBACK_ORDER;
  const glyphs = look ? new Map([...look.byLabel.values()].map(v => [v.group, v.glyph])) : new Map();
  [...actions.querySelectorAll('button[data-action]')].forEach((b, i) => {
    const l = b.querySelector('.lbl');
    const hit = look && l && look.byLabel.get(l.textContent.trim().toLowerCase());
    const group = hit ? hit.group : order[i];
    if (!group) return;
    b.setAttribute('data-group', group);
    let g = b.querySelector('.glyph');
    if (!g) { g = el('span', { class: 'glyph', 'aria-hidden': 'true' }); b.prepend(g); }
    const glyph = (hit && hit.glyph) || glyphs.get(group) || '';
    if (glyph) g.setAttribute('data-glyph', glyph); // drawn by ::before, so the button's text stays the label (specs match on it)
  });
}

export function drawHud(hud) {
  const box = el('section', { class: 'hud', 'aria-label': 'Status' });
  for (const r of (hud && hud.rows) || []) {
    box.append(el('div', { class: 'hud-row' + (r.id === 'cash' ? ' big' : ''), 'data-hud': r.id, 'data-tile': r.id },
      el('span', { class: 'label', text: r.label }), el('span', { class: 'text', text: r.text })));
  }
  return box;
}

export function drawHome(panel, reply, onPress) {
  const s = reply.screen;
  const actions = actionList(s.actions, onPress);
  actions.classList.add('grid'); // a grid on wide screens so every Home action fits at 1280 by 720
  for (const b of actions.querySelectorAll('button')) { // N393 (r58 i1): the role name is the label without its digit
    const l = b.querySelector('.lbl');
    if (l && l.textContent) b.setAttribute('aria-label', l.textContent);
  }
  applyLook(actions);
  panel.append(el('h1', { class: 'home-title', text: s.title }), drawHud(reply.hud), linesList(withoutHud(s.lines, reply.hud)), actions); // N148: no HUD repeats
}
