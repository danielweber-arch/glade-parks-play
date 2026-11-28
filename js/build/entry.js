// P7.7 part A: how build mode opens. main.js imports this once. Open with ?build=1 or #build in the address, or window.gpBuild()
// or the B key (part B). Loads css/build.css itself so index.html stays as it is.
import { openBuild } from './index.js';

let open = null;
function css() {
  if (document.querySelector('link[data-build-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/build.css'; l.setAttribute('data-build-css', ''); document.head.appendChild(l);
}
export async function startBuild() {
  if (open && open.root.isConnected) return open;
  css();
  try { open = await openBuild(document.body); } catch (e) { open = null; console.warn('build mode:', e.message); }
  return open;
}
window.gpBuild = startBuild;
// P7.7 part B, owner addition 7 (PC first): B opens build mode, Escape closes it (index.js handles Escape while open).
// Kept here, not in js/input or Data/ui/input-map.json (x6 owns those); the controller binding comes later.
window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'b' && ev.key !== 'B') return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (open && open.root.isConnected) return;
  ev.preventDefault(); startBuild();
});
if (/[?&]build=1\b/.test(location.search) || location.hash === '#build') startBuild();
