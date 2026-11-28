// Shared drawing helpers. Only draws what the Reply holds; no game rules.
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
}

export function linesList(lines) {
  const ul = el('ul', { class: 'lines' });
  for (const line of lines || []) {
    const i = line.indexOf(': ');
    if (i > 0) ul.append(el('li', {}, el('span', { class: 'k', text: line.slice(0, i + 2) }), el('span', { text: line.slice(i + 2) })));
    else ul.append(el('li', { text: line }));
  }
  return ul;
}

export function actionButton(a, onPress, cls = 'btn') {
  const b = el('button', { class: cls, type: 'button', 'data-action': a.id, 'data-back': a.back ? 'true' : null,
    'aria-disabled': a.enabled === false ? 'true' : null, title: a.enabled === false && a.whyNot ? a.whyNot : null },
    el('span', { class: 'lbl', text: a.label }), a.key ? el('span', { class: 'hint', text: a.key, 'aria-hidden': 'true' }) : null);
  b.addEventListener('click', () => onPress(a.id));
  return b;
}

export function actionList(actions, onPress) {
  const box = el('div', { class: 'actions' });
  for (const a of actions || []) box.append(actionButton(a, onPress));
  return box;
}

// N148, N334: lines the HUD tiles already show. A line is dropped only when its "Label: " key is a HUD row's label (or the
// whole line is "Label: text" of that row). A value alone never drops a line, so a non-HUD "$0" line stays when cash is $0.
// Lines carry no ids in contract v1, so the row's own label is the link; the rows to hide are picked by id.
export const HUD_ROW_IDS = ['date', 'cash', 'netWorth', 'inbox']; // Web/Host/HudBuilder.cs row ids
export function withoutHud(lines, hud) {
  const rows = ((hud && hud.rows) || []).filter(r => HUD_ROW_IDS.includes(r.id));
  const keys = new Set(rows.map(r => (r.label || '').trim().toLowerCase()).filter(Boolean));
  return (lines || []).filter(line => {
    const i = String(line).indexOf(':');
    return !(i > 0 && keys.has(String(line).slice(0, i).trim().toLowerCase()));
  });
}
