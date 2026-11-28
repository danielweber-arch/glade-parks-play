// P7.9 part B: how the city map opens. main.js imports this once. Open with ?city=1 or #city, or window.gpCity().
// Loads css/city.css itself so index.html stays as it is.
import { openCity } from './map.js';

let open = null;
function css() {
  if (document.querySelector('link[data-city-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/city.css'; l.setAttribute('data-city-css', ''); document.head.appendChild(l);
}
export async function startCity() {
  if (open && open.root.isConnected) return open;
  css();
  try { open = await openCity(document.body); } catch (e) { open = null; console.warn('city map:', e.message); }
  return open;
}
window.gpCity = startCity;
// N357: M opens the city map from the keyboard (UI.OpenCity in Data/ui/input-map.json); typing in a field never opens it.
window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'm' && ev.key !== 'M') return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (open && open.root.isConnected) return;
  if (document.querySelector('.gp-talk, [data-creator], [data-cine-layer]')) return; // a talk, the creator or a scene owns the keys
  ev.preventDefault(); startCity();
});
if (/[?&]city=1\b/.test(location.search) || location.hash === '#city') startCity();
