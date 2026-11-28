import { el, linesList, actionList } from './common.js';
import { drawHud } from './home.js';

// Any other screen: title, lines, action rows. kind number shows a number row
// and sends the digits back as the action.
export function drawGeneric(panel, reply, onPress, words = {}) {
  const s = reply.screen;
  panel.append(el('h1', { text: s.title }));
  if (reply.hud && s.id !== 'start') panel.append(drawHud(reply.hud));
  panel.append(linesList(s.lines));
  if (s.kind === 'number') {
    const input = el('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', 'aria-label': s.prompt || s.title, 'data-number': true });
    const ok = el('button', { class: 'btn primary', type: 'button', 'data-action': 'number-submit' }, el('span', { text: words.enter || 'Enter' }));
    const send = () => { const v = input.value.replace(/[^0-9]/g, ''); if (v) onPress(v); };
    ok.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) send(); } });
    if (s.prompt) panel.append(el('p', { text: s.prompt }));
    panel.append(el('div', { class: 'number-row' }, input, ok));
  }
  panel.append(actionList(s.actions, onPress));
}
