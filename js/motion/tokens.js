// Reads the motion tokens from the generated css/motion.css custom properties, so the CSS stays the one source.
const FALLBACK = { focus: 80, panelOpen: 160, panelClose: 120, largeMove: 240, countUp: 400, slide: 12, stagger: 30,
  staggerMax: 5, reduceFade: 120, easeOut: 'cubic-bezier(0.2, 0, 0, 1)', easeIn: 'cubic-bezier(0.4, 0, 1, 1)' };

function prop(cs, name) { return (cs.getPropertyValue(name) || '').trim(); }

export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const num = (name, def) => { const v = parseFloat(prop(cs, name)); return Number.isFinite(v) ? v : def; };
  return {
    focus: num('--motion-focus', FALLBACK.focus),
    panelOpen: num('--motion-panel-open', FALLBACK.panelOpen),
    panelClose: num('--motion-panel-close', FALLBACK.panelClose),
    largeMove: num('--motion-large-move', FALLBACK.largeMove),
    countUp: num('--motion-count-up', FALLBACK.countUp),
    slide: num('--motion-slide', FALLBACK.slide),
    stagger: num('--motion-stagger', FALLBACK.stagger),
    staggerMax: num('--motion-stagger-max', FALLBACK.staggerMax),
    reduceFade: num('--motion-reduce-fade', FALLBACK.reduceFade), // raw, like the CSS path; the data check owns a bad value
    easeOut: prop(cs, '--motion-ease-out') || FALLBACK.easeOut,
    easeIn: prop(cs, '--motion-ease-in') || FALLBACK.easeIn,
  };
}
