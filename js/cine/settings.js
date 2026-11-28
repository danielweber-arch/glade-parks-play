// Scene and sound settings (plan-cinematic appendix C), saved per browser in localStorage.
// Every read and write is in try and catch: blocked storage gives the defaults and never throws.
// No settings screen yet (deferred); added to window.gp as gp.settings.
const SPEC = {
  scenes: { key: 'gp.settings.scenes', dflt: 'full', parse: (v) => (['full', 'short', 'off'].includes(v) ? v : null) },
  musicVol: { key: 'gp.settings.musicVol', dflt: 1, parse: vol },
  stingerVol: { key: 'gp.settings.stingerVol', dflt: 1, parse: vol },
  uiVol: { key: 'gp.settings.uiVol', dflt: 1, parse: vol },
  mute: { key: 'gp.settings.mute', dflt: 'off', parse: (v) => (v === 'on' || v === 'off' ? v : null) },
};

function vol(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

export function getSetting(name) {
  const s = SPEC[name];
  if (!s) return undefined;
  try {
    const v = s.parse(window.localStorage.getItem(s.key));
    return v === null ? s.dflt : v;
  } catch (e) { return s.dflt; }
}

export function setSetting(name, value) {
  const s = SPEC[name];
  if (!s) return false;
  const v = s.parse(typeof value === 'boolean' ? (value ? 'on' : 'off') : String(value));
  if (v === null) return false;
  try { window.localStorage.setItem(s.key, String(v)); return true; } catch (e) { return false; }
}

export function allSettings() {
  const out = {};
  for (const name of Object.keys(SPEC)) out[name] = getSetting(name);
  return out;
}

export const settings = { get: getSetting, set: setSetting, all: allSettings, keys: () => Object.keys(SPEC) };
try { window.gp = Object.assign(window.gp || {}, { settings }); } catch (e) { /* no window */ }
