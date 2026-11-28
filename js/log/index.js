// P7.13 session log: records each screen shown (id, time on it), each action pressed, refused
// replies and Backs, and posts batches to POST /api/session-log, which appends them to the same
// session log the play console writes. Stuck uses the console rule (Tools/play/Core/SessionLog.cs):
// 3 Backs or 3 refusals on one screen. No game rules here: it only reads replies.
export const STUCK_AT = 3;
const BATCH = 60;

export function createSessionLog({ post = defaultPost, now = () => performance.now() } = {}) {
  let events = [];
  let screen = null;
  let actions = [];
  const backs = {};
  const refused = {};
  const push = (e) => { events.push({ ...e, at: Math.round(now()) }); if (events.length >= BATCH) flush(); };
  const bump = (d) => { const k = screen || '?'; d[k] = (d[k] || 0) + 1; };

  function seen(reply) {
    const s = reply && reply.screen;
    if (!s || !s.id) return;
    actions = s.actions || [];
    if (s.id !== screen) { screen = s.id; push({ t: 'screen', id: s.id }); }
  }
  function pressed(id, reply) {
    const a = actions.find((x) => x.id === id) || {};
    if (a.back) { bump(backs); push({ t: 'back' }); return; }
    if (reply && reply.ok === false) {
      bump(refused);
      push({ t: 'refused', id: String(id), why: String(reply.error || '') });
      return;
    }
    const msg = reply && Array.isArray(reply.messages) && reply.messages.length ? reply.messages[0] : '';
    push({ t: 'choice', id: String(id), label: String(a.label || ''), result: String(msg || '') });
  }
  function stuck() {
    const keys = new Set([...Object.keys(backs), ...Object.keys(refused)]);
    return [...keys].sort().filter((k) => (backs[k] || 0) >= STUCK_AT || (refused[k] || 0) >= STUCK_AT);
  }
  function flush() {
    if (!events.length) return Promise.resolve(null);
    const batch = events; events = [];
    return post({ events: batch });
  }
  return { seen, pressed, stuck, flush, pending: () => events.length };
}

function defaultPost(body) {
  return fetch('/api/session-log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true,
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

// Wraps the transport in place (like watchQuarter): every reply is seen, every act is a press.
// Posts on page hide too. Exposes window.gpLog for tests and the play-test sheet.
export function installSessionLog(transport, target = window) {
  const log = createSessionLog();
  for (const m of ['state', 'newGame', 'load', 'save', 'endQuarter', 'command', 'act']) {
    const fn = transport[m];
    if (typeof fn !== 'function') continue;
    transport[m] = (...args) => Promise.resolve(fn.apply(transport, args)).then((reply) => {
      if (m === 'act') log.pressed(args[0] && args[0].action, reply);
      else if (m === 'endQuarter') log.pressed('end-quarter', reply);
      log.seen(reply);
      return reply;
    });
  }
  if (target && target.addEventListener) {
    target.addEventListener('pagehide', () => { log.flush(); });
    target.gpLog = log;
  }
  return log;
}
