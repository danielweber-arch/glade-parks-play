// Loads the shared input map (Data/ui/input-map.json, served at data/ui/).
// If it fails, falls back to a minimal built-in Navigate, Submit, Cancel.
export const FALLBACK = {
  fallback: true,
  tunables: { stickDeadZone: { value: 0.35 }, repeatDelayMs: { value: 400 }, repeatRateMs: { value: 120 }, holdToConfirmMs: { value: 600 } },
  maps: [{ id: 'UI', actions: [
    { id: 'Navigate', keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], pad: ['button:12', 'button:13', 'button:14', 'button:15', 'axis:0-', 'axis:0+', 'axis:1-', 'axis:1+'] },
    { id: 'Submit', keys: ['Enter', 'Space'], pad: ['button:0'] },
    { id: 'Cancel', keys: ['Escape', 'Backspace'], pad: ['button:1'] },
  ] }],
};

export async function loadInputMap(url = 'data/ui/input-map.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('status ' + res.status);
    const map = await res.json();
    if (!map || !Array.isArray(map.maps)) throw new Error('no maps');
    return map;
  } catch (e) {
    console.warn('input map: using built-in fallback', e && e.message);
    return FALLBACK;
  }
}

export function uiMap(map) {
  return (map.maps || []).find((m) => m.id === 'UI') || FALLBACK.maps[0];
}

export function tunable(map, name, dflt) {
  const t = map.tunables && map.tunables[name];
  return t && typeof t.value === 'number' ? t.value : dflt;
}
