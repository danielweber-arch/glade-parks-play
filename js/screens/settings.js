// Sound and scenes screen (P12.11b part B): a client side screen, not a Sim menu. It reads and
// writes the appendix C keys through js/cine/settings.js and turns the page's one audio player
// (pageAudio in js/cine/dress.js) up, down or quiet at once. Each button steps to the next choice,
// so one press changes it. Back (the button, Escape or the controller's Back) returns to the
// screen it was opened from.
import { el } from './common.js';
import { getSetting, setSetting } from '../cine/settings.js';
import { pageAudio } from '../cine/dress.js';

const SCENES = ['full', 'short', 'off'];
const STEPS = [0, 0.33, 0.66, 1]; // Off, Low, Mid, Full
const BUSES = [['music', 'musicVol'], ['stinger', 'stingerVol'], ['ui', 'uiVol']];

export const SETTINGS_WORDS = {
  settingsOpen: 'Sound and scenes',
  settingsTitle: 'Sound and scenes',
  settingsLine: 'Press a button to change it. Changes count right away.',
  scenes: 'Scenes', full: 'Full', short: 'Short', off: 'Off', low: 'Low', mid: 'Mid', on: 'On',
  music: 'Music', stinger: 'Big moments', ui: 'Buttons', mute: 'All sound off', back: 'Back', // N419: back is a last-resort string; the word lives in Data/ui/lexicon.json (concept "back")
  // r58-i5 Part 2: the browser build's save download. Default only until text/shell.json carries saveDownload (requested).
  saveDownload: 'Download my save', saveDownloadNone: 'No save yet. Save a game first.',
};
// The transport that can hand over a save file (the browser build); null on the local host.
function saveSource() { try { const t = window.gp && window.gp.transport; return t && typeof t.downloadSave === 'function' ? t : null; } catch (e) { console.error('[settings] transport', e); return null; } }

const nearest = (v) => STEPS.reduce((b, s, i) => (Math.abs(s - v) < Math.abs(STEPS[b] - v) ? i : b), 0);
const stepWord = (w, i) => [w.off, w.low, w.mid, w.full][i];
// The page's audio player, only when scenes are on (cine off makes none and needs none).
function liveAudio() { try { return window.gp && window.gp.flow ? pageAudio() : null; } catch (e) { return null; } }

export function drawSettings(panel, { words = {}, onBack }) {
  const w = { ...SETTINGS_WORDS, ...words };
  panel.replaceChildren();
  panel.setAttribute('data-screen', 'sound-settings');
  panel.setAttribute('data-kind', 'menu');
  const box = el('div', { class: 'actions settings' });
  function row(id, label, value, onPress) {
    const b = el('button', { class: 'btn', type: 'button', 'data-action': 'set-' + id, 'data-setting': id, 'data-value': value.key },
      el('span', { class: 'lbl', text: `${label}: ${value.word}` }));
    b.addEventListener('click', () => { onPress(); const again = panel.querySelector(`[data-setting="${id}"]`); if (again) again.focus(); });
    return b;
  }
  function paint() {
    const keep = document.activeElement && document.activeElement.getAttribute('data-setting');
    box.replaceChildren();
    const sc = getSetting('scenes');
    box.append(row('scenes', w.scenes, { key: sc, word: w[sc] }, () => { setSetting('scenes', SCENES[(SCENES.indexOf(sc) + 1) % SCENES.length]); paint(); }));
    for (const [bus, key] of BUSES) {
      const i = nearest(getSetting(key));
      box.append(row(bus, w[bus], { key: String(STEPS[i]), word: stepWord(w, i) }, () => {
        const next = STEPS[(i + 1) % STEPS.length];
        const a = liveAudio();
        if (a) a.setVolume(bus, next); else setSetting(key, next);
        paint();
      }));
    }
    const m = getSetting('mute');
    box.append(row('mute', w.mute, { key: m, word: m === 'on' ? w.on : w.off }, () => {
      const a = liveAudio();
      if (a) a.setMute(m !== 'on'); else setSetting('mute', m === 'on' ? 'off' : 'on');
      paint();
    }));
    const src = saveSource();
    if (src) {
      const dl = el('button', { class: 'btn', type: 'button', 'data-action': 'set-save-download', 'data-setting': 'save-download' }, el('span', { class: 'lbl', text: w.saveDownload }));
      dl.addEventListener('click', async () => {
        const ok = await src.downloadSave();
        dl.setAttribute('data-downloaded', ok ? 'true' : 'false');
        if (!ok) dl.querySelector('.lbl').textContent = w.saveDownloadNone;
        dl.focus();
      });
      box.append(dl);
    }
    const back = el('button', { class: 'btn', type: 'button', 'data-action': 'settings-back', 'data-back': 'true' }, el('span', { class: 'lbl', text: w.back }));
    back.addEventListener('click', () => onBack());
    box.append(back);
    const f = keep && box.querySelector(`[data-setting="${keep}"]`);
    if (f) f.focus();
  }
  panel.append(el('h1', { text: w.settingsTitle }), el('ul', { class: 'lines' }, el('li', { text: w.settingsLine })), box);
  paint();
  const first = box.querySelector('[data-action]');
  if (first) first.focus();
}

// The entry button on Start and Home. It carries data-client and no data-action, so the router never focuses it
// first and every `[data-action]` reader (smoke counts, the first-action focus checks) sees the Sim menu as before.
export function settingsEntry(words, onOpen) {
  const w = { ...SETTINGS_WORDS, ...words };
  const b = el('button', { class: 'btn client-entry', type: 'button', 'data-client': 'settings' },
    el('span', { class: 'lbl', text: w.settingsOpen }));
  b.addEventListener('click', onOpen);
  // N357 (audit M1, M2): 3D build and the city map open by pressing, not only by the B key or an address hash.
  const mode = (id, text, open) => {
    const m = el('button', { class: 'btn client-entry', type: 'button', 'data-client': id }, el('span', { class: 'lbl', text }));
    m.addEventListener('click', () => { const f = window[open]; if (typeof f === 'function') f(); });
    return m;
  };
  // Settings stays last, so Up from the first menu entry still lands on it (owner call 50 path: Up, Enter).
  return el('div', { class: 'client-bar' }, mode('build', w.buildOpen || '3D build', 'gpBuild'), mode('city', w.cityOpen || 'City map', 'gpCity'), b);
}
