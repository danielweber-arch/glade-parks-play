// Eases for the ShotMath port. Same set and formulas as the sim (appendix A).
// Input u is clamped to 0..1 by the caller.
export const EASES = {
  linear: (u) => u,
  hold: () => 0,
  inOutSine: (u) => 0.5 * (1 - Math.cos(Math.PI * u)),
  inCubic: (u) => u * u * u,
  outCubic: (u) => 1 - Math.pow(1 - u, 3),
  inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  outQuint: (u) => 1 - Math.pow(1 - u, 5),
  outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
};

// Unknown ease names fall back to linear so a bad list never stalls a scene.
export function ease(name, u) {
  const f = EASES[name] || EASES.linear;
  return f(u);
}
