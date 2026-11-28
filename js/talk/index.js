// P7.10 B: the talk panel. Draws the TalkView the host gives (GET /api/talk/scene) and finishes with FinishTalk on
// /api/command. No game rules here: odds words or percent, locks and their notes all come from the Sim.
// Open with window.dispatchEvent(new CustomEvent('gp-talk', { detail: { scene, offer, site } })) or gpTalk.open(...).
import { padNav } from './pad.js';

const css = document.createElement('link');
css.rel = 'stylesheet'; css.href = new URL('../../css/talk.css', import.meta.url).href;
document.head.appendChild(css);

const COLORS = ['#2f6f8f', '#8f4f2f', '#4f7f3f', '#6f3f8f', '#8f2f5f', '#3f5f8f'];
export function avatarFor(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { initials, color: COLORS[h % COLORS.length] };
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// N337 (r53 e1): story: true is a story choice scene (cine block story). It ends through AnswerStoryScene (the reply path)
// sent with send(cmd) (the cine flow passes transport.command), and it cannot be backed out of: no reply, no ending.
export function openTalk({ scene, offer = -1, site = '', story = false, send = null, onDone = null }) {
  const root = el('section', 'gp-talk'); root.setAttribute('role', 'dialog'); root.setAttribute('data-talk', scene);
  if (story) root.setAttribute('data-story', 'true');
  document.body.appendChild(root);
  const path = []; let view = null, active = 0, isOpen = true;
  // N368 (r56 g1): keys belong to the panel only while it is open. close() drops the capture listener once (idempotent), so
  // after it the global keys (KeyB 3D build, KeyM City map, Escape, number keys) reach main.js again.
  const close = (result) => {
    if (!isOpen) return;
    isOpen = false;
    root.remove(); window.removeEventListener('keydown', onKey, true); pad.stop();
    if (onDone) onDone(result);
    window.dispatchEvent(new CustomEvent('gp-talk-done', { detail: result }));
  };

  async function load() {
    const q = new URLSearchParams({ scene, path: path.join(','), offer: String(offer), site: site || '' });
    const r = await fetch('/api/talk/scene?' + q.toString());
    view = r.ok ? await r.json() : { error: await r.text(), lines: [], choices: [] };
    if (view.ended && !view.error) return finish();
    active = Math.max(0, (view.choices || []).findIndex((c) => !c.locked));
    draw();
  }
  async function finish() {
    const cmd = story ? { name: 'AnswerStoryScene', args: { Path: path } }
      : { name: 'FinishTalk', args: { Scene: scene, Path: path, OfferId: offer, SiteId: site || null } };
    let reply;
    if (send) { try { reply = await send(cmd); } catch (e) { reply = null; } reply = reply || { ok: false }; }
    else {
      const r = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
      reply = await r.json().catch(() => ({ ok: false }));
    }
    root.setAttribute('data-finished', reply.ok ? 'ok' : 'error');
    draw();
    setTimeout(() => close(reply), 50);
  }
  function draw() {
    root.replaceChildren();
    if (view.error) { const e = el('p', 'gp-talk-error', view.error); e.setAttribute('data-talk-error', ''); root.appendChild(e); }
    for (const l of view.lines || []) {
      const row = el('div', 'gp-talk-line'); row.setAttribute('data-line', l.id || ''); row.setAttribute('data-reply', String(!!l.reply));
      if (l.miss) row.setAttribute('data-miss', 'true');
      if (l.name) {
        const a = avatarFor(l.name); const av = el('span', 'gp-talk-avatar', a.initials);
        av.style.background = a.color; av.setAttribute('data-avatar', a.initials); av.setAttribute('aria-hidden', 'true'); row.appendChild(av);
      }
      const body = el('p', 'gp-talk-text');
      if (l.name) { const n = el('span', 'gp-talk-name', l.name); n.setAttribute('data-speaker', l.name); body.appendChild(n); }
      body.appendChild(document.createTextNode(l.text || '')); row.appendChild(body); root.appendChild(row);
    }
    const list = el('ol', 'gp-talk-choices');
    (view.choices || []).forEach((c, i) => {
      const li = el('li'); const b = el('button', 'gp-talk-choice');
      b.type = 'button'; b.setAttribute('data-choice', String(c.index)); b.setAttribute('data-locked', String(!!c.locked));
      b.setAttribute('data-active', String(i === active)); if (c.skillCheck) b.setAttribute('data-odds', String(c.oddsPct));
      if (c.locked) b.setAttribute('aria-disabled', 'true');
      b.appendChild(document.createTextNode((i + 1) + '. ' + c.text));
      if (c.note) { const n = el('span', 'gp-talk-note', c.note); n.setAttribute('data-note', ''); b.appendChild(n); }
      b.addEventListener('click', () => pick(i));
      li.appendChild(b); list.appendChild(li);
    });
    // r60 k1 (N355 c): a talk you can leave shows Back as the last numbered row, so a mouse can leave it too and its
    // number key backs out one reply (closes at the start), the same as Escape. A story choice scene has no Back.
    if (!story) {
      const li = el('li'); const b = el('button', 'gp-talk-choice gp-talk-back');
      b.type = 'button'; b.setAttribute('data-back', 'true');
      // K1-2: the word comes from the host (TalkRoutes view.back, the screens' Back word); 'Back' only if an old host sent none.
      b.appendChild(document.createTextNode(((view.choices || []).length + 1) + '. ' + (view.back || 'Back')));
      b.addEventListener('click', () => back());
      li.appendChild(b); list.appendChild(li);
    }
    root.appendChild(list);
  }
  function pick(i) {
    const c = (view.choices || [])[i];
    if (!c || c.locked) return;
    path.push(c.index); load();
  }
  // N355: the panel takes every key while it is open (capture phase), so the screen under it never acts on the same press.
  function onKey(e) {
    if (!isOpen || !root.isConnected) { window.removeEventListener('keydown', onKey, true); return; } // removed from outside: let the key through
    e.stopPropagation();
    if (!view) return;
    const n = (view.choices || []).length;
    if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) { e.preventDefault(); pick(Number(e.key) - 1); }
    else if (!story && /^[1-9]$/.test(e.key) && Number(e.key) === n + 1) { e.preventDefault(); back(); }
    else if (e.key === 'ArrowDown' && n) { e.preventDefault(); active = (active + 1) % n; draw(); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); active = (active + n - 1) % n; draw(); }
    else if (e.key === 'Enter') { // K1-1: Enter acts on the focused row (Back backs out); `active` only when focus is elsewhere
      const f = document.activeElement, mine = f && root.contains(f) && f.closest ? f : null;
      if (mine && mine.closest('.gp-talk-back')) { e.preventDefault(); if (!e.repeat) back(); return; }
      if (!n) return;
      e.preventDefault();
      const fb = mine && mine.closest('[data-choice]');
      const i = fb ? (view.choices || []).findIndex((c) => String(c.index) === fb.getAttribute('data-choice')) : -1;
      if (!e.repeat) pick(i >= 0 ? i : active);
    }
    else if (e.key === 'Escape') { e.preventDefault(); back(); }
  }
  window.addEventListener('keydown', onKey, true);
  function back() {
    if (!view || root.hasAttribute('data-finished')) return;
    if (path.length) { path.pop(); load(); } else if (!story) close({ ok: false, abandoned: true }); // nothing applied, no roll taken
  }
  // N309 (owner addition 7, PC first then controller): d-pad or stick moves, A picks, B backs out one reply.
  const pad = padNav({
    move: (d) => { const n = (view && view.choices || []).length; if (!n) return; active = (active + d + n) % n; draw(); },
    pick: () => { if (view && (view.choices || []).length) pick(active); },
    back,
  });
  load();
  return { close };
}

window.addEventListener('gp-talk', (e) => { e.preventDefault(); openTalk(e.detail || {}); });
window.gpTalk = { open: openTalk };
