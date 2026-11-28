// P7.9 part D: street encounters and traffic boxes while driving.
// Encounters: entering a district asks the host (MeetEncounter through /api/command). When one shows, the car stops and a
// window 'gp-encounter' CustomEvent fires with { id }. The encounter screen (y4) listens and calls event.preventDefault()
// to claim it (r58 j6: drive/picker.js does), then fires 'gp-encounter-done' when the player is finished. If nobody claims it, a fallback line shows.
// Traffic: GET /api/city/traffic every second, drawn as moving boxes.
import { trafficLayer } from './scene.js';
import { readPending } from './picker.js';

export function startExtras({ root, world, car, say, command, stopCar }) {
  const traffic = trafficLayer(world.scene);
  const districts = (world.view && world.view.districts) || [];
  let district = null, waiting = false, asking = false, tTraffic = 0, clock = 0, alive = true;
  const done = () => { waiting = false; root.removeAttribute('data-encounter'); };
  window.addEventListener('gp-encounter-done', done);

  function where() {
    let best = null, bd = Infinity;
    for (const d of districts) { const r = Math.hypot(car.x - d.x, car.z - d.z); if (r <= d.radius && r < bd) { bd = r; best = d; } }
    return best;
  }
  // r58 j6: the car stops and 'gp-encounter' fires; drive/picker.js claims it. Also used on open for one already waiting.
  function meet(id, districtId) {
    waiting = true; stopCar(); root.setAttribute('data-encounter', id);
    const ev = new CustomEvent('gp-encounter', { detail: { id, district: districtId }, cancelable: true });
    window.dispatchEvent(ev);
    if (!ev.defaultPrevented) { say('Someone on the street wants a word. Open the encounter from the main screen.', 5); setTimeout(done, 3000); }
  }
  async function arrive(d) {
    asking = true;
    try {
      const r = await command('MeetEncounter', { District: d.id });
      if (r && r.value === 1 && alive) meet((r.messages || [])[0] || '', d.id);
      else if (alive) { const c = await readPending(); if (c && alive && !waiting) meet(c.id || '', c.district || d.id); } // r59 j6: one put off by Escape shows again on arrival
    } catch (e) { /* no encounter this time */ } finally { asking = false; }
  }
  async function pullTraffic() {
    try {
      const r = await fetch('/api/city/traffic?t=' + clock.toFixed(2));
      if (r.ok && alive) root.setAttribute('data-traffic', String(traffic.set((await r.json()).cars)));
    } catch (e) { /* keep the last boxes */ }
  }
  { const d0 = where(); district = d0 ? d0.id : null; root.setAttribute('data-district', district || ''); } // no encounter for the district you start in
  return {
    paused: () => waiting,
    meet,
    tick(dt) {
      clock += dt; tTraffic -= dt;
      if (tTraffic <= 0) { tTraffic = 1; pullTraffic(); }
      const d = where();
      const id = d ? d.id : null;
      if (id !== district) { district = id; root.setAttribute('data-district', id || ''); if (d && !waiting && !asking) arrive(d); }
    },
    dispose() { alive = false; window.removeEventListener('gp-encounter-done', done); },
  };
}
