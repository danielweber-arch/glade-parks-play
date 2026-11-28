// P7.9 part C: the GTA V style chase camera, ported from Data/camera.json "car" (fetched from /api/city/camera, read only).
// Pure math, no three.js, so node and Playwright can check it. Same formulas as Sim/Camera/CameraRig.cs.
const DEG = Math.PI / 180;
const num = (cam, k, d) => (cam && cam[k] && typeof cam[k].value === 'number' ? cam[k].value : d);

/** Resting pose behind a car of the given size: meters behind its center, meters up, degrees of downward pitch, FOV. */
export function restPose(cam, length, height) {
  const behind = num(cam, 'baseDistance') + num(cam, 'distancePerLength') * length;
  const up = height + num(cam, 'heightAboveRoof');
  const pitchDown = Math.atan2(up - num(cam, 'lookAtHeight'), behind + num(cam, 'lookAhead')) / DEG;
  return { behind, height: up, pitchDown, fov: num(cam, 'fov') };
}

/** Field of view at a speed share 0..1 of top speed. */
export function fovAt(cam, share) {
  const s = Math.max(0, Math.min(1, share));
  return num(cam, 'fov') + (num(cam, 'fovAtTopSpeed') - num(cam, 'fov')) * s;
}

const follow = (dt, lag) => (lag <= 0 ? 1 : 1 - Math.exp(-dt / lag));
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** The chase rig: soft spring on position (followLag) and heading (yawLag), free look with recenter, look behind. */
export function createChase(cam, carLength, carHeight) {
  const rest = restPose(cam, carLength, carHeight);
  const st = { yaw: null, x: 0, y: 0, z: 0, lookYaw: 0, lookPitch: 0, idle: 0, fov: rest.fov };
  const recenterDelay = num(cam, 'recenterDelay', 1.5), recenterSpeed = num(cam, 'recenterSpeed', 120) * DEG;
  const pMin = num(cam, 'lookPitchMin', -15), pMax = num(cam, 'lookPitchMax', 40);
  const lookAhead = num(cam, 'lookAhead'), lookAt = num(cam, 'lookAtHeight');
  const canBehind = !(cam && cam.lookBehind && cam.lookBehind.value === false);

  /** car: {x, z, heading (radians, forward = (sin, cos))}, speedShare 0..1. look: {dx, dy (degrees), behind}. */
  function update(dt, car, share, look) {
    look = look || {};
    if (st.yaw === null) st.yaw = car.heading;
    st.yaw = wrap(st.yaw + wrap(car.heading - st.yaw) * follow(dt, num(cam, 'yawLag', 0.28)));
    if (look.dx || look.dy) {
      st.idle = 0;
      st.lookYaw = wrap(st.lookYaw + (look.dx || 0) * DEG);
      st.lookPitch = Math.max(pMin - rest.pitchDown, Math.min(pMax - rest.pitchDown, st.lookPitch + (look.dy || 0)));
    } else {
      st.idle += dt;
      if (st.idle >= recenterDelay) {
        const step = recenterSpeed * dt;
        st.lookYaw = Math.abs(st.lookYaw) <= step ? 0 : st.lookYaw - Math.sign(st.lookYaw) * step;
        st.lookPitch = Math.abs(st.lookPitch) <= step / DEG ? 0 : st.lookPitch - Math.sign(st.lookPitch) * step / DEG;
      }
    }
    const yaw = st.yaw + st.lookYaw + (look.behind && canBehind ? Math.PI : 0);
    const pitch = (rest.pitchDown + st.lookPitch) * DEG;
    // Orbit the aim point at the resting slant range, so pitch changes swing the camera rather than move it in.
    const aimX = car.x + Math.sin(car.heading) * lookAhead, aimZ = car.z + Math.cos(car.heading) * lookAhead;
    const range = Math.hypot(rest.behind + lookAhead, rest.height - lookAt);
    const hx = aimX - Math.sin(yaw) * Math.cos(pitch) * range, hz = aimZ - Math.cos(yaw) * Math.cos(pitch) * range;
    const hy = lookAt + Math.sin(pitch) * range;
    if (!st.started) { st.x = hx; st.y = hy; st.z = hz; st.started = true; }
    const k = look.behind ? 1 : follow(dt, num(cam, 'followLag', 0.12));
    st.x += (hx - st.x) * k; st.y += (hy - st.y) * k; st.z += (hz - st.z) * k;
    st.fov += (fovAt(cam, share) - st.fov) * follow(dt, 0.3);
    return { x: st.x, y: st.y, z: st.z, aim: { x: aimX, y: lookAt, z: aimZ }, fov: st.fov };
  }
  return { rest, update, state: st };
}
