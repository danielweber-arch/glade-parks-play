// Pure helpers for the overlay: bar math and time windows. No DOM.
export const BAR_SLIDE = 0.24;   // section 4: bars slide in over 240 ms
export const CARD_IN = 0.16;     // section 8: panel opens in 160 ms
export const CARD_OUT = 0.12;    // and closes in 120 ms
export const DIP = 0.4;          // fade up from black after the bars land
export const GRAIN_FPS = 12;     // section 4: grain steps 12 times a second
export const HOLD_SECONDS = 2;   // locked decision 10

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Height of each bar so the open frame is width / aspect (or the full height if wider).
export function barHeight(width, height, aspect) {
  const frame = Math.min(height, width / aspect);
  return (height - frame) / 2;
}

export const active = (o, t) => t >= o.at && t < o.at + o.dur;

// 0 to 1 envelope for an overlay window: rises over tin, falls over tout.
export function envelope(o, t, tin, tout) {
  if (!active(o, t)) return 0;
  return Math.min(clamp01((t - o.at) / tin), clamp01((o.at + o.dur - t) / tout));
}

// Dip to black: full black while the bars slide, then fades up; leaves the same way.
export function dipAlpha(o, t) {
  if (!o || t < o.at || t > o.at + o.dur) return 0;
  const a = 1 - clamp01((t - o.at - BAR_SLIDE) / DIP);
  const b = 1 - clamp01((o.at + o.dur - BAR_SLIDE - t) / DIP);
  return Math.max(a, b);
}

// Ease out for arriving, ease in for leaving (no bounce).
export const easeOut = (u) => 1 - (1 - u) * (1 - u);

// Fixed offsets so the grain steps the same way on every run (no Math.random).
export function grainOffset(t) {
  const step = Math.floor(t * GRAIN_FPS);
  const h = (Math.imul(step + 1, 2654435761) >>> 0);
  return [(h & 127) - 64, ((h >>> 8) & 127) - 64];
}

export function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const fill = (tpl, vals) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (k in vals ? String(vals[k]) : ''));
