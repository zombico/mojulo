/**
 * xr-driver — the `xr` device family's driver (devices.js `driver: 'webxr-gamepad'`), and the thumbstick shaping a
 * headset's locomotion reads through.
 *
 * Its own closure, the controls-kernel discipline (references nothing outside itself, so a page runs the same code by
 * emitting `buildXrDriver.toString()`), and its own module so only a page with a WebXR session carries it: the kernel
 * is in every game page, and a page that cannot open a session reads no headset.
 *
 *   xrRead(sources, D, analog?)   → read for the kernel: an XRSession's inputSources (any list of { handedness,
 *                                   gamepad }) → read('left.thumbstickY'), a button 0..1, an axis -1..1
 *   stick(x, y, dead, axial)      → [x, y]: a RADIAL dead zone, the travel past it rescaled to 0..1, and a push within
 *                                   `axial` radians of a cardinal snapped onto it, so a push forward goes straight
 *   xrPoses(frame, ref, sources)  → the POSES (devices.js xr.poses): { head, left: { grip, aim }, right: { grip, aim } },
 *                                   each { p: [x, y, z], q: [x, y, z, w] } in the reference space as WebXR gives it
 *                                   (the rig's local frame: y up, −Z forward), or null where the frame has none
 *   poseToWorld(pose, rig)        → the pose in the z-up world, rig = { pos: [x, y, z], yaw } (the page's rig: local +Y →
 *                                   world +Z, local −Z → world heading `yaw`, its quaternion Qz(yaw − π/2) · Qx(+π/2))
 *   turn(q, v)                    → v turned by the quaternion q (a pose's axis: [0, 0, −1] is its forward)
 *
 * Poses are plain arrays, so a recorded stream replays in Node through poseToWorld exactly as the page plays it.
 *
 * Meta Quest Touch, Touch Plus (Quest 3 / 3S) and Touch Pro all speak xr-standard: trigger 0, grip 1, (no touchpad) 2,
 * thumbstick click 3, A / X 4, B / Y 5, the thumbstick on axes 2 and 3. The menu buttons are the system's, never a page's.
 */

export function buildXrDriver() {
  // one gamepad per hand; a hand with both a tracked hand and a controller reads the one with more axes. A two-axis pad
  // (an early runtime, before xr-standard reserved axes 0 and 1 for a touchpad) carries its thumbstick at 0 and 1.
  function xrRead(sources, D, analog) {
    const X = D.xr, by = {};
    for (const s of sources || []) {
      const g = s && s.gamepad, h = s && s.handedness;
      if (!g || (h !== 'left' && h !== 'right')) continue;
      if (!by[h] || (g.axes || []).length > (by[h].axes || []).length) by[h] = g;
    }
    return (c) => {
      const m = /^(left|right)\.([A-Za-z0-9]+)$/.exec(c || '');
      const g = m && by[m[1]];
      if (!g) return 0;
      const n = m[2];
      if (X.buttons[n] !== undefined) {
        const b = (g.buttons || [])[X.buttons[n]];
        if (!b) return 0;
        return analog ? b.value || 0 : (b.pressed ? 1 : b.value || 0);
      }
      if (X.axes[n] !== undefined) {
        const ax = g.axes || [];
        const i = ax.length < 4 && /^thumbstick/.test(n) ? X.axes[n] - 2 : X.axes[n];
        return +ax[i] || 0;
      }
      return 0;
    };
  }

  // a square dead zone (each axis on its own) lets a worn stick's drift, or a thumb a few degrees off true, leak into the
  // other axis the moment the push clears it: forward curves. Radial, rescaled, snapped near a cardinal, it does not.
  function stick(x, y, dead, axial) {
    const sx = +x || 0, sy = +y || 0, m = Math.hypot(sx, sy), d = Math.min(Math.max(+dead || 0, 0), 0.95);
    if (!(m > d)) return [0, 0];
    const r = Math.min(1, (m - d) / (1 - d)), a = Math.atan2(sy, sx), q = Math.PI / 2, k = Math.round(a / q);
    if (axial > 0 && Math.abs(a - k * q) <= axial) {
      const c = ((k % 4) + 4) % 4;
      return [c === 0 ? r : c === 2 ? -r : 0, c === 1 ? r : c === 3 ? -r : 0];
    }
    return [r * Math.cos(a), r * Math.sin(a)];
  }

  // the poses OpenXR names: the viewer (`head`), each hand's grip space (the closed fist's centre, −Z along the hole it
  // closes round) and its target ray (`aim`). One source per hand: the first that carries a space wins.
  function xrPoses(frame, ref, sources) {
    const out = { head: null, left: { grip: null, aim: null }, right: { grip: null, aim: null } };
    if (!frame || !ref) return out;
    const pk = (pose) => {
      if (!pose || !pose.transform) return null;
      const p = pose.transform.position, o = pose.transform.orientation;
      return { p: [+p.x || 0, +p.y || 0, +p.z || 0], q: o ? [+o.x || 0, +o.y || 0, +o.z || 0, o.w === undefined ? 1 : +o.w] : [0, 0, 0, 1] };
    };
    out.head = pk(frame.getViewerPose ? frame.getViewerPose(ref) : null);
    for (const s of sources || []) {
      const h = s && s.handedness;
      if ((h !== 'left' && h !== 'right') || !frame.getPose) continue;
      if (!out[h].grip && s.gripSpace) out[h].grip = pk(frame.getPose(s.gripSpace, ref));
      if (!out[h].aim && s.targetRaySpace) out[h].aim = pk(frame.getPose(s.targetRaySpace, ref));
    }
    return out;
  }

  // quaternions as [x, y, z, w]: a·b, and v turned by q
  const qmul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  function turn(q, v) {
    const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx];
  }
  // the page's rig: Qz(yaw − π/2) · Qx(+π/2) (channels/xr.js __xrSetYaw), then its position
  function poseToWorld(pose, rig) {
    if (!pose) return null;
    const h = ((rig && rig.yaw) || 0) - Math.PI / 2, s = Math.SQRT1_2;
    const R = qmul([0, 0, Math.sin(h / 2), Math.cos(h / 2)], [s, 0, 0, s]), o = (rig && rig.pos) || [0, 0, 0], v = turn(R, pose.p);
    return { p: [o[0] + v[0], o[1] + v[1], o[2] + v[2]], q: qmul(R, pose.q) };
  }

  return { xrRead, stick, xrPoses, poseToWorld, turn };
}
