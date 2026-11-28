// P7.7 tool wheel: type, floors and tier. T or the Tools button opens it at the cursor. The host sends ONLY the types
// legal at that cell (/api/build/wheel, built by Sim/BuildView/ToolWheel.cs) with each type's floors range and the tier
// names; the client lays them out and keeps the choice in state. Placing still goes through the place flow (P or Place),
// which sends PlaceBuilding with the chosen floors and tier. A blocked cell shows the host's one line instead.
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function wireWheel(root, state, { getJson, check }) {
  const box = root.querySelector('[data-build-wheel]');
  let open = false, items = new Map();
  function pick(it) {
    state.type = it.id; state.typeName = it.name;
    state.floorRange = it.floors || null;
    state.floors = it.floors ? Math.max(it.floors[0], Math.min(it.floors[1], it.floorsDefault || it.floors[0])) : 1;
    state.tiers = !!it.tiers;
    const sel = root.querySelector('[data-build-type]');
    if (sel && !sel.querySelector(`option[value="${it.id}"]`)) sel.insertAdjacentHTML('beforeend', `<option value="${it.id}">${esc(it.name)}</option>`);
    if (sel) sel.value = String(it.id);
    paint(); check();
  }
  function paint() {
    box.querySelectorAll('[data-wheel-type]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.wheelType === state.type)));
    const f = box.querySelector('[data-wheel-floors]'); if (f) f.textContent = String(state.floors || 1);
    box.querySelectorAll('[data-wheel-tier]').forEach((b) => { b.setAttribute('aria-pressed', String(+b.dataset.wheelTier === state.tier)); b.disabled = !state.tiers; });
    root.dataset.choice = `${state.type}:${state.floors || 1}:${state.tier}`;
  }
  async function show() {
    const w = await getJson(`/api/build/wheel?x=${state.i}&y=${state.j}`).catch(() => null);
    if (!w) return;
    items = new Map();
    const ring = w.groups.map((g) => `<fieldset class="wheel-group"><legend>${esc(g.label)}</legend>${g.items.map((it) => {
      items.set(it.id, it);
      return `<button type="button" data-wheel-type="${it.id}" style="--swatch:${esc(g.color)}">${esc(it.name)}</button>`;
    }).join('')}</fieldset>`).join('');
    box.innerHTML = `<p class="wheel-why" data-wheel-why>${esc(w.reason)}</p><div class="wheel-ring" role="group" aria-label="${esc(w.typeLabel)}">${ring}</div>`
      + `<div class="wheel-row"><span>${esc(w.floorsLabel)}</span><button type="button" data-wheel-less aria-label="Fewer floors">-</button>`
      + `<b data-wheel-floors></b><button type="button" data-wheel-more aria-label="More floors">+</button></div>`
      + `<div class="wheel-row" role="group" aria-label="${esc(w.tierLabel)}"><span>${esc(w.tierLabel)}</span>${w.tierNames.map((t) => `<button type="button" data-wheel-tier="${t.tier}">${esc(t.name)}</button>`).join('')}</div>`;
    box.hidden = false; open = true; root.dataset.wheel = 'open';
    if (!items.has(state.type) && items.size) pick(items.values().next().value); else if (items.has(state.type)) pick(items.get(state.type)); else paint();
    const first = box.querySelector('[data-wheel-type]'); if (first) first.focus();
  }
  function hide() { box.hidden = true; open = false; root.dataset.wheel = 'closed'; root.querySelector('[data-build-canvas]').focus(); }
  function floors(d) { if (!state.floorRange) return; state.floors = Math.max(state.floorRange[0], Math.min(state.floorRange[1], (state.floors || 1) + d)); paint(); }
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.wheelType) pick(items.get(+b.dataset.wheelType));
    else if (b.hasAttribute('data-wheel-less')) floors(-1);
    else if (b.hasAttribute('data-wheel-more')) floors(1);
    else if (b.dataset.wheelTier) { state.tier = +b.dataset.wheelTier; paint(); }
  });
  box.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Escape' || ev.key === 't' || ev.key === 'T') { hide(); ev.preventDefault(); }
    else if (ev.key === '[') { floors(-1); ev.preventDefault(); }
    else if (ev.key === ']') { floors(1); ev.preventDefault(); }
  });
  root.querySelector('[data-build-tools]').addEventListener('click', () => (open ? hide() : show()));
  return {
    key(ev) {
      if (ev.key === 't' || ev.key === 'T') { if (open) hide(); else show(); return true; }
      if (ev.key === '[') { floors(-1); return true; }
      if (ev.key === ']') { floors(1); return true; }
      return false;
    },
    get open() { return open; },
  };
}
