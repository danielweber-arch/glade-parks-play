import { el, linesList, actionButton } from './common.js';

// Phone folders as a tile grid. Each tile is a word, never an icon alone.
export function drawPhone(panel, reply, onPress) {
  const s = reply.screen;
  const tiles = el('div', { class: 'tiles' });
  const backs = el('div', { class: 'actions' });
  for (const a of s.actions || []) (a.back ? backs : tiles).append(actionButton(a, onPress, a.back ? 'btn' : 'btn tile'));
  panel.append(el('h1', { text: s.title }), linesList(s.lines), tiles, backs);
}
