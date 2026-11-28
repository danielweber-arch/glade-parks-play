// P7.7 part B: place, start and undo in build mode. Every change is a Sim command sent to POST /api/command
// (PlaceBuilding runs PlaceRect, which draws the plan, StartConstruction breaks ground and posts the equity through Ledger.Post, Undo pops the
// session undo). The client holds no rules: a refusal shows the host's one-line reason.
// Keys (PC first): P places the chosen type at the cursor, U or Ctrl+Z undoes, G starts building.
const FOOT = 4; // cells a side the cursor footprint covers; the host decides if it fits.

// N357: the current site goes with every place and demolish (the HUD's leases.siteId, else the site the build view shows).
export async function currentSiteId(fallback) {
  try {
    const tr = window.gp && window.gp.transport;
    const st = tr && tr.state ? await tr.state() : null;
    const id = st && ((st.hud && st.hud.leases && st.hud.leases.siteId) || (st.leases && st.leases.siteId));
    if (id) return id;
  } catch (e) { /* the build view's site below */ }
  return fallback || '';
}

export async function command(name, args) {
  const tr = window.gp && window.gp.transport;
  if (tr && tr.command) {
    try { const b = await tr.command({ name, args: args || {} }); return b && !b.error ? b : { error: (b && b.error) || 'That did not work. Try again.' }; }
    catch (e) { return { error: (e && e.message) || 'That did not work. Try again.' }; }
  }
  const r = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, args: args || {} }) });
  let body = null; try { body = await r.json(); } catch (e) { body = null; }
  if (!r.ok || !body) return { error: (body && body.error) || 'That did not work. Try again.' };
  return body;
}

export function wirePlace(root, state, { getJson, redraw, followCursor, say }) {
  async function after(reply) {
    const fresh = await getJson('/api/build/site');
    state.refusal = reply.error || ''; // shown on the reason line until the next command
    await redraw(fresh);
    if (reply.error) { say(reply.error); root.dataset.refused = reply.error; } else { root.removeAttribute('data-refused'); }
    return reply;
  }
  async function place() {
    // PlaceBuilding = PlaceRect plus the wheel's tier (Sim/BuildView/PlaceBuilding.cs); floors and tier come from the wheel.
    const siteId = await currentSiteId(state.siteId);
    const reply = await command('PlaceBuilding', { siteId, i0: state.i, j0: state.j, i1: state.i + FOOT - 1, j1: state.j + FOOT - 1, type: state.type, floors: state.floors || 1, tier: state.tier == null ? 1 : state.tier });
    followCursor();
    return after(reply);
  }
  const start = async () => after(await command('StartConstruction', {}));
  const undo = async () => after(await command('Undo', {}));
  root.querySelector('[data-build-place]').addEventListener('click', place);
  root.querySelector('[data-build-start]').addEventListener('click', start);
  root.querySelector('[data-build-undo]').addEventListener('click', undo);
  return {
    place, start, undo,
    key(ev) {
      const k = ev.key.toLowerCase();
      if (k === 'p') { place(); return true; }
      if (k === 'u' || (k === 'z' && (ev.ctrlKey || ev.metaKey))) { undo(); return true; }
      if (k === 'g') { start(); return true; }
      return false;
    },
  };
}
