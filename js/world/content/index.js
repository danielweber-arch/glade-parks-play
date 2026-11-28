// N440: open world content for n3's shell. Places, markers, minimap, compass, hint. Purely visual: no commands, no state.
// Interface: createWorldContent({ THREE, scene, view, root, onPick, onEnter }) -> { places, tick, nearest, setHint, dispose }.
import { resolvePlaces, nearestPlace } from './places.js';
import { buildMarkers } from './markers.js';
import { buildHud } from './hud.js';

const val = (o, k, d) => (o && o[k] && typeof o[k] === 'object' && 'value' in o[k] ? o[k].value : d);
async function getJson(url) { try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } }

export async function createWorldContent({ THREE, scene, view, root, onPick, onEnter }) {
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('../../../css/world-content.css', import.meta.url).href; css.setAttribute('data-world-css', '');
  document.head.append(css);
  const [file, tune] = await Promise.all([getJson('/data/ui/world-places.json'), getJson('/data/ui/world-content.json')]);
  const places = resolvePlaces(file || { places: [] }, view);
  const markers = buildMarkers(THREE, scene, places, val(tune, 'markerHeight', 36));
  const hud = buildHud({ root, view, places, onPick, onEnter, size: val(tune, 'minimapPixels', 180) });
  const reduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  root.setAttribute('data-world-places', String(places.length));
  root.setAttribute('data-world-nearest', '');
  const extras = []; // Part B layers (people, traffic) register { tick, dispose } here.
  let disposed = false;

  return {
    places,
    tick(dt, car) {
      if (disposed || !car) return;
      const still = !!reduce.matches;
      markers.tick(dt, still);
      const near = nearestPlace(places, car.x, car.z);
      const id = near ? near.place.id : '';
      if (root.getAttribute('data-world-nearest') !== id) root.setAttribute('data-world-nearest', id);
      hud.update(dt, car, near);
      for (const x of extras) x.tick(dt, car, still);
    },
    nearest: (x, z) => nearestPlace(places, x, z),
    setHint: (text) => hud.setHint(text),
    dispose() {
      if (disposed) return; disposed = true;
      for (const x of extras) x.dispose();
      markers.dispose(); hud.dispose(); css.remove();
      for (const a of ['data-world-places', 'data-world-nearest', 'data-world-people', 'data-world-cars']) root.removeAttribute(a);
    },
  };
}
