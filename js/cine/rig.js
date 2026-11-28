// ShotMath port: a shot and a time give a camera pose. Pure, no three.js.
// Right handed, Y up. Linear in degrees, no wrap. FOV = 2 * atan(12 / lensMm).
import { ease } from './ease.js';

const RAD = Math.PI / 180;

export function fovFromLens(lensMm) {
  return (2 * Math.atan(12 / lensMm)) / RAD;
}

// A shot owns at <= t < at + dur. The last shot also owns the end and beyond.
export function shotIndexAt(shots, t) {
  if (!shots || shots.length === 0) return -1;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (t >= s.at && t < s.at + s.dur) return i;
  }
  return t < shots[0].at ? 0 : shots.length - 1;
}

function lerp(a, b, e) {
  return a + (b - a) * e;
}

// subjects: id -> { center: [x, y, z], radius }
export function shotPose(shot, subject, t, opts = {}) {
  const c = subject.center;
  const R = subject.radius;
  const u = Math.min(1, Math.max(0, (t - shot.at) / shot.dur));
  const e = opts.reduceMotion ? 0 : ease(shot.ease, u);
  const az = lerp(shot.from.az, shot.to.az, e) * RAD;
  const el = lerp(shot.from.el, shot.to.el, e) * RAD;
  const dist = lerp(shot.from.dist, shot.to.dist, e);
  return {
    shot: shot.n,
    position: [
      c[0] + R * dist * Math.sin(az) * Math.cos(el),
      c[1] + R * dist * Math.sin(el),
      c[2] + R * dist * Math.cos(az) * Math.cos(el),
    ],
    target: [c[0], c[1], c[2]],
    fov: fovFromLens(shot.lensMm),
    roll: shot.roll || 0,
  };
}

export function subjectMap(list) {
  const map = {};
  for (const s of (list.set && list.set.subjects) || []) map[s.id] = s;
  return map;
}

// Pose of a whole list at time t. Pure: same inputs give the same output.
export function poseAt(list, t, opts = {}) {
  const shots = list.shots || [];
  const i = shotIndexAt(shots, t);
  if (i < 0) return null;
  const subs = opts.subjects || subjectMap(list);
  const shot = shots[i];
  const subject = subs[shot.subject];
  if (!subject) return null;
  return shotPose(shot, subject, t, opts);
}
