// Scenes Off note (N238, plan-cinematic P12.11b done-when and decision 15): with Scenes Off a waiting scene
// plays nothing and shows ONE line plus the cash row instead. No bars, no canvas, no player. The line is the
// scene's money hold line when it has one, else its title, else its first caption. The cash row is the
// Reply's own HUD cash row (the sim posts money before a scene, so it is already the new figure).
// One note at a time; the next press (key, pointer or a new note) takes it down.

function lineOf(list) {
  const o = (list && list.overlays) || [];
  const first = (type, key) => { const x = o.find((v) => v && v.type === type && v[key]); return x ? String(x[key]) : ''; };
  return first('moneyHold', 'line') || first('title', 'text') || first('caption', 'text');
}

export function cashOf(reply) {
  const rows = (reply && reply.hud && reply.hud.rows) || [];
  return rows.find((r) => r && r.id === 'cash') || null;
}

let current = null;

export function clearNote() {
  if (!current) return;
  const n = current; current = null;
  n.off();
  n.box.remove();
}

// reply: the Reply that carried the cine block; returns the note element (or null when there is nothing to show).
export function showNote(reply) {
  clearNote();
  const text = lineOf(reply && reply.cine && reply.cine.list);
  const cash = cashOf(reply);
  if (!text && !cash) return null;
  const box = document.createElement('div');
  box.className = 'cine-note';
  box.setAttribute('data-cine-note', '');
  box.setAttribute('role', 'status');
  if (reply && reply.cine && reply.cine.id !== undefined) box.setAttribute('data-cine-id', String(reply.cine.id));
  const line = document.createElement('p');
  line.className = 'cine-note-line';
  line.setAttribute('data-cine-note-line', '');
  line.textContent = text;
  line.hidden = !text;
  box.append(line);
  if (cash) {
    const row = document.createElement('p');
    row.className = 'cine-note-cash';
    row.setAttribute('data-cine-note-cash', '');
    const label = document.createElement('span'); label.className = 'label'; label.textContent = cash.label || '';
    const value = document.createElement('span'); value.className = 'text'; value.textContent = cash.text || '';
    row.append(label, value);
    box.append(row);
  }
  document.body.append(box);
  // Listeners go on after this frame so the press that started the new game does not take the note down.
  const drop = () => clearNote();
  let on = false;
  const t = setTimeout(() => { on = true; window.addEventListener('keydown', drop, true); window.addEventListener('pointerdown', drop, true); }, 0);
  current = { box, off: () => { clearTimeout(t); if (on) { window.removeEventListener('keydown', drop, true); window.removeEventListener('pointerdown', drop, true); } } };
  return box;
}
