// P7.9 part B: the city map screen (graybox). A 2D top view of /api/city/view: districts, roads, landmarks, lots for sale
// and your properties, with a fast travel list that is always there. No game rules here: the host says what is for sale
// and where you may jump (CityFastTravel answers yes or why not).
async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function command(name, args) {
  // N357: through the game's transport when the page has one (main.js window.gp.transport).
  const tr = window.gp && window.gp.transport;
  if (tr && tr.command) { try { const b = await tr.command({ name, args: args || {} }); return b || { error: 'That did not work. Try again.' }; } catch (e) { return { error: (e && e.message) || 'That did not work. Try again.' }; } }
  const r = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, args: args || {} }) });
  return r.json();
}

function el(tag, attrs, text) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
}

export function draw(canvas, view) {
  const g = canvas.getContext('2d'); const css = getComputedStyle(canvas);
  const ink = css.getPropertyValue('--ink').trim() || '#1D1F24', line = css.getPropertyValue('--line').trim() || '#C9C4B8';
  const good = css.getPropertyValue('--good').trim() || '#1B7F4B', accent = css.getPropertyValue('--accent').trim() || '#1F5FBF';
  const warn = css.getPropertyValue('--warn').trim() || '#B26B00';
  const [x0, z0, x1, z1] = view.bounds; const pad = 60;
  const w = canvas.width, h = canvas.height;
  const s = Math.min(w / (x1 - x0 + pad * 2), h / (z1 - z0 + pad * 2));
  const P = (x, z) => [(x - x0 + pad) * s, h - (z - z0 + pad) * s];
  g.clearRect(0, 0, w, h);
  g.font = '12px system-ui';
  for (const d of view.districts) {
    const [cx, cy] = P(d.x, d.z);
    g.beginPath(); g.arc(cx, cy, d.radius * s, 0, Math.PI * 2); g.strokeStyle = line; g.lineWidth = 1; g.stroke();
    g.fillStyle = ink; g.fillText(d.name, cx - 30, cy - d.radius * s + 14);
  }
  const nodes = Object.fromEntries(view.nodes.map((n) => [n.id, n]));
  for (const r of view.roads) {
    const a = nodes[r.from], b = nodes[r.to]; if (!a || !b) continue;
    const [ax, ay] = P(a.x, a.z), [bx, by] = P(b.x, b.z);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokeStyle = r.freeway ? warn : ink; g.lineWidth = r.freeway ? 4 : 1.5 + r.lanes; g.stroke();
  }
  for (const l of view.lots) {
    const [lx, ly] = P(l.x - l.width / 2, l.z + l.depth / 2);
    g.fillStyle = l.status === 'for_sale' ? good : l.status === 'mine' ? accent : line;
    g.globalAlpha = l.status ? 0.85 : 0.35; g.fillRect(lx, ly, l.width * s, l.depth * s); g.globalAlpha = 1;
  }
  for (const p of view.properties) { const [px, py] = P(p.x, p.z); g.fillStyle = accent; g.fillRect(px - 6, py - 6, 12, 12); }
  for (const m of view.landmarks) { const [mx, my] = P(m.x, m.z); g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fillStyle = ink; g.fill(); g.fillText(m.name, mx + 7, my + 4); }
}

export async function openCity(host = document.body) {
  const root = el('section', { 'data-city': '', 'data-ready': '0', role: 'dialog', 'aria-label': 'City map' });
  root.appendChild(el('p', { 'data-city-tag': '' }, 'graybox'));
  const head = el('h2', {}, 'City map');
  const close = el('button', { type: 'button', 'data-city-close': '' }, 'Close');
  // N357: closing (button, Back, Escape) tells the page to redraw (gp-redraw, the router listens).
  const shut = () => { if (!root.isConnected) return; root.remove(); window.removeEventListener('keydown', esc); window.dispatchEvent(new Event('gp-redraw')); };
  const esc = (ev) => { if (ev.key === 'Escape' && root.isConnected) { ev.preventDefault(); shut(); } };
  window.addEventListener('keydown', esc);
  close.onclick = shut;
  // P7.9 part C: the graybox drive mode. The city map closes while you drive; leaving the drive opens it again.
  const drive = el('button', { type: 'button', 'data-city-drive': '' }, 'Drive');
  drive.onclick = async () => {
    const { openDrive } = await import('../drive/entry.js');
    root.remove(); window.removeEventListener('keydown', esc);
    try { await openDrive(); } catch (e) { host.appendChild(root); line.textContent = 'Drive mode did not start. ' + e.message; }
  };
  const canvas = el('canvas', { 'data-city-canvas': '', width: '720', height: '640' });
  const side = el('div', { 'data-city-side': '' });
  const line = el('p', { 'data-city-line': '', 'aria-live': 'polite' }, '');
  const top = el('div', { 'data-city-top': '' }); top.append(head, drive);
  root.append(top, close, canvas, side, line);
  host.appendChild(root);

  async function refresh() {
    const view = await getJson('/api/city/view');
    draw(canvas, view);
    const forSale = view.lots.filter((l) => l.status === 'for_sale').length;
    root.setAttribute('data-districts', String(view.districts.length));
    root.setAttribute('data-landmarks', String(view.landmarks.length));
    root.setAttribute('data-for-sale', String(forSale));
    root.setAttribute('data-properties', String(view.properties.length));
    side.replaceChildren(el('h3', {}, 'Fast travel'));
    const list = el('ul', {});
    for (const d of view.fastTravel) {
      const b = el('button', { type: 'button', 'data-city-travel': d.id }, d.label);
      b.onclick = async () => {
        const r = await command('CityFastTravel', { Place: d.id });
        if (r.error) { line.textContent = r.error; return; }
        root.setAttribute('data-arrived', (r.messages || [])[0] || '');
        line.textContent = 'You are at ' + d.label + '.';
        window.dispatchEvent(new CustomEvent('gp-city-arrive', { detail: { id: d.id, node: (r.messages || [])[0], x: d.x, z: d.z } }));
      };
      const li = el('li', {}); li.appendChild(b); list.appendChild(li);
    }
    side.appendChild(list);
    if (!view.fastTravel.length) side.appendChild(el('p', {}, 'Nowhere to jump right now.'));
    return view;
  }
  await refresh();
  root.setAttribute('data-ready', '1');
  return { root, refresh };
}
