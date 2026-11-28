// r58 j6, N357 (audit M3): the drive-mode reply picker. Claims the window 'gp-encounter' event (preventDefault), reads the
// waiting card (GET /api/encounter/pending through the transport path below), shows its replies over the drive view as
// focusable buttons, sends AnswerEncounter {Choice: index} on a pick, shows the reply line, then fires 'gp-encounter-done'
// so the car drives again. Card and reply text come from the host (Dialogue/encounters/*.ink); nothing is written here.
// Transport: commands go through window.gp.transport.command when the app is running (http, wasm or stub alike), and
// the card read uses transport.get when a backend offers one, else a same-origin relative path. No host is hard-coded.

const LEAVE_MS = 1600;

function el(tag, attrs, text) { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }

export async function readPending() {
  const t = window.gp && window.gp.transport;
  if (t && typeof t.get === 'function') return t.get('/api/encounter/pending');
  const r = await fetch('/api/encounter/pending', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  return r.status === 200 ? r.json() : null;
}

export function startPicker({ root, command }) {
  let box = null;
  const send = (name, args) => {
    const t = window.gp && window.gp.transport;
    return t && typeof t.command === 'function' ? t.command({ name, args }) : command(name, args);
  };
  function finish() {
    if (box) { box.remove(); box = null; }
    root.removeAttribute('data-encounter-open');
    const c = root.querySelector('[data-drive-canvas]'); if (c) c.focus();
    window.dispatchEvent(new CustomEvent('gp-encounter-done'));
  }
  // r59 j6, N405 root cause: input/keyboard.js listens on window and calls preventDefault on Enter and Space (Submit),
  // which cancels the focused reply button's own click; its focus.intent('submit') then sees focus outside the panel
  // and moves focus back to the panel. So while the card is open the picker takes Enter, Space and Escape first
  // (window, capture phase): Enter or Space presses the focused reply, Escape closes the card. Escape keeps the
  // encounter pending on the host (no command is sent); it shows again on the next drive open or district arrival,
  // and the car is free, so a second Escape leaves the drive.
  function onKey(e) {
    if (!box || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) finish(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && a && box.contains(a) && a.matches('[data-encounter-reply]')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat && !a.disabled) a.click();
    }
  }
  window.addEventListener('keydown', onKey, true);
  function show(card) {
    box = el('div', { 'data-encounter-card': card.id || '', role: 'dialog', 'aria-modal': 'true', 'aria-label': card.text || '',
      style: 'position:absolute;left:50%;bottom:12%;transform:translateX(-50%);max-width:min(640px,92%);padding:16px;'
        + 'background:rgba(20,24,28,.92);color:#fff;border-radius:10px;font:16px/1.4 system-ui,sans-serif;z-index:5' });
    const text = el('p', { 'data-encounter-text': '', style: 'margin:0 0 12px' }, card.text || '');
    const list = el('div', { 'data-encounter-replies': '', style: 'display:flex;flex-direction:column;gap:8px' });
    const line = el('p', { 'data-encounter-result': '', 'aria-live': 'polite', style: 'margin:12px 0 0;min-height:1.4em' }, '');
    (card.replies || []).forEach((r, i) => {
      const b = el('button', { type: 'button', 'data-encounter-reply': String(r.index), 'data-client': 'encounter-reply',
        style: 'text-align:left;padding:8px 12px;font:inherit;border-radius:6px;border:1px solid #888;background:#2b3138;color:#fff;cursor:pointer' },
        (i + 1) + '. ' + r.text + (r.note ? ' (' + r.note + ')' : ''));
      if (!r.affordable) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
      b.addEventListener('click', () => pick(r.index, list, line));
      list.appendChild(b);
    });
    list.addEventListener('keydown', (e) => {
      const btns = [...list.querySelectorAll('button:not([disabled])')];
      const at = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        const n = btns.length; if (!n) return;
        btns[((at < 0 ? 0 : at + (e.key === 'ArrowDown' ? 1 : -1)) + n) % n].focus();
      } else if (/^[1-9]$/.test(e.key)) {
        const b = list.querySelectorAll('button')[Number(e.key) - 1]; if (b && !b.disabled) { e.preventDefault(); b.click(); }
      }
    });
    box.append(text, list, line);
    root.appendChild(box);
    root.setAttribute('data-encounter-open', card.id || '');
    const first = list.querySelector('button:not([disabled])'); if (first) first.focus();
  }
  async function pick(index, list, line) {
    list.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    let r = null;
    try { r = await send('AnswerEncounter', { Choice: index }); } catch (e) { r = null; }
    if (r && r.ok) {
      line.textContent = (r.messages || []).join(' ');
      root.setAttribute('data-encounter-answered', String(index));
      setTimeout(finish, LEAVE_MS);
    } else {
      line.textContent = (r && r.error) || (r && (r.messages || []).join(' ')) || '';
      list.querySelectorAll('button').forEach((b) => { b.disabled = b.getAttribute('aria-disabled') === 'true'; });
      const f = list.querySelector('button:not([disabled])'); if (f) f.focus();
    }
  }
  async function claim(ev) {
    if (box) return;
    ev.preventDefault();
    let card = null;
    try { card = await readPending(); } catch (e) { card = null; }
    if (!card || !card.replies || card.replies.length === 0) { finish(); return; }
    show(card);
  }
  window.addEventListener('gp-encounter', claim);
  return { dispose() { window.removeEventListener('gp-encounter', claim); window.removeEventListener('keydown', onKey, true); if (box) box.remove(); box = null; } };
}
