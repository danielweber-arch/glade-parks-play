// Keyboard: maps KeyboardEvent.code through the UI map to focus intents.
// Only Navigate repeats while a key is held: a held Enter must not press the
// next screen's first action too. Keys with Ctrl, Cmd or Alt go to the browser.
import { uiMap } from './map.js';

const DIR = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

export function attachKeyboard(map, focus) {
  const ui = uiMap(map);
  const codes = (id) => new Set(((ui.actions || []).find((a) => a.id === id) || {}).keys || []);
  const nav = codes('Navigate'), submit = codes('Submit'), cancel = codes('Cancel'), phone = codes('OpenPhone');
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // N368: any text field (creator name, number prompt, textarea, contenteditable) keeps its letters.
    const t = e.target;
    const typing = !!t && (t.isContentEditable || (t.matches && t.matches('input, textarea, select')));
    if (typing && e.code !== 'Escape' && !e.code.startsWith('Arrow')) return;
    let it = null;
    if (nav.has(e.code)) it = DIR[e.code] || null;
    else if (submit.has(e.code)) it = 'submit';
    else if (cancel.has(e.code)) it = 'cancel';
    else if (phone.has(e.code)) it = 'phone';
    if (!it) return;
    e.preventDefault();
    if (e.repeat && !nav.has(e.code)) return;
    focus.intent(it);
  });
}
