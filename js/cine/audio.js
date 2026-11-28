// WebAudio cue player: plan-cinematic section 5, appendix B recipes, appendix C settings keys.
// Silent start: no AudioContext exists before the first press. Sound never carries a fact.
import { getSetting, setSetting } from './settings.js';

const BUSES = ['music', 'stinger', 'ui'];
// Volumes and mute are read and written through js/cine/settings.js (appendix C keys).
const VOL = { music: 'musicVol', stinger: 'stingerVol', ui: 'uiVol' };
const vol = (bus) => getSetting(VOL[bus]);

export function createAudio({ cues = [] } = {}) {
  const byId = new Map(cues.map((c) => [c.id, c]));
  const vols = Object.fromEntries(BUSES.map((b) => [b, vol(b)]));
  let muted = getSetting('mute') === 'on';
  let ctx = null;
  let buses = null;
  let noise = null;

  function applyGains() {
    if (!buses) return;
    for (const b of BUSES) buses[b].gain.value = muted ? 0 : vols[b];
  }

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    buses = {};
    for (const b of BUSES) { buses[b] = ctx.createGain(); buses[b].connect(ctx.destination); }
    applyGains();
    return ctx;
  }

  const onFirstPress = () => { unlock(); window.removeEventListener('pointerdown', onFirstPress, true); window.removeEventListener('keydown', onFirstPress, true); };
  window.addEventListener('pointerdown', onFirstPress, true);
  window.addEventListener('keydown', onFirstPress, true);

  function noiseBuffer() {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
    return noise;
  }

  function layer(l, out, t0, nodes, sources) {
    let src;
    if (l.wave === 'noise') {
      src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    } else {
      src = ctx.createOscillator(); src.type = l.wave || 'sine';
      const f0 = l.freq || 440, f1 = l.toFreq || f0;
      src.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(f1, t0 + (l.attack || 0) + (l.decay || 0.1));
    }
    nodes.push(src); sources.push(src);
    let head = src;
    if (l.filter || l.cutoff) {
      const f = ctx.createBiquadFilter(); f.type = l.filter || 'lowpass'; f.frequency.value = l.cutoff || 1000;
      head.connect(f); head = f; nodes.push(f);
    }
    const env = ctx.createGain();
    const a = Math.max(0.001, l.attack || 0), d = Math.max(0.01, l.decay || 0.1), g = l.gain ?? 0.5;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(g, t0 + a);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    head.connect(env); env.connect(out); nodes.push(env);
    src.start(t0); src.stop(t0 + a + d + 0.05);
  }

  function pad(p, cue, out, t0, nodes, sources) {
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = p.cutoff || 900;
    const env = ctx.createGain();
    const a = Math.max(0.01, p.attack || 1), r = Math.max(0.01, p.release || 1);
    env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(1, t0 + a);
    filter.connect(env); env.connect(out); nodes.push(filter, env);
    const notes = p.notes || [220];
    for (const n of notes) {
      const o = ctx.createOscillator(); o.type = p.wave || 'triangle'; o.frequency.value = n;
      const g = ctx.createGain(); g.gain.value = 1 / notes.length;
      o.connect(g); g.connect(filter); nodes.push(o, g); sources.push(o); o.start(t0);
    }
    if (p.lfoHz) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = p.lfoHz;
      const depth = ctx.createGain(); depth.gain.value = (p.cutoff || 900) * 0.3;
      lfo.connect(depth); depth.connect(filter.frequency); nodes.push(lfo, depth); sources.push(lfo); lfo.start(t0);
    }
    const loop = p.loop ?? cue.loop ?? false;
    const stopAt = (when) => {
      env.gain.cancelScheduledValues(when); env.gain.setValueAtTime(env.gain.value, when);
      env.gain.linearRampToValueAtTime(0, when + r);
      for (const s of sources) { try { s.stop(when + r + 0.05); } catch { /* already stopped */ } }
    };
    if (!loop) stopAt(t0 + a);
    return stopAt;
  }

  // Builds one cue's graph and starts it. Returns { id, count, stop }.
  function build(id) {
    const cue = byId.get(id);
    if (!cue) throw new Error(`audio: no cue ${id}`);
    if (!ctx) throw new Error('audio: no press yet');
    const nodes = [], sources = [];
    const out = ctx.createGain(); out.gain.value = cue.gain ?? 1; out.connect(buses[cue.bus] || buses.ui); nodes.push(out);
    const t0 = ctx.currentTime;
    let stopPad = null;
    const r = cue.recipe || {};
    for (const l of r.layers || []) layer(l, out, t0, nodes, sources);
    if (r.pad) stopPad = pad(r.pad, cue, out, t0, nodes, sources);
    const stop = () => {
      if (stopPad) stopPad(ctx.currentTime);
      else for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } }
    };
    return { id, count: nodes.length, stop };
  }

  function play(id) { if (!ctx || (muted)) return null; try { return build(id); } catch { return null; } }

  function setMute(on) { muted = !!on; setSetting('mute', muted ? 'on' : 'off'); applyGains(); }
  function setVolume(bus, v) {
    if (!BUSES.includes(bus)) return;
    vols[bus] = Math.min(1, Math.max(0, Number(v) || 0)); setSetting(VOL[bus], vols[bus]); applyGains();
  }
  const gains = () => (buses ? Object.fromEntries(BUSES.map((b) => [b, buses[b].gain.value])) : null);
  const state = () => (ctx ? ctx.state : 'none');

  // The cues can arrive after boot (N208 part 2c): the unlock listener exists before the data does.
  function setCues(list) { for (const c of Array.isArray(list) ? list : []) byId.set(c.id, c); }

  return { unlock, build, play, setMute, setVolume, gains, state, setCues, cues: () => [...byId.keys()] };
}
