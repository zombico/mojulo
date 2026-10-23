/**
 * kin.js — the small rigid-body arithmetic the transformation bake runs on: quaternions as plain [x, y, z, w]
 * arrays (the rig figure's own order), vectors as [x, y, z]. Pure, deterministic, no allocation tricks.
 */

export const DEG = Math.PI / 180;
export const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;   // + 0 folds −0

export const QI = Object.freeze([0, 0, 0, 1]);

export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);

export function qnorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// a ⊗ b: rotate by b, then by a
export function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];

export function qaxis(axis, angle) {
  const l = vlen(axis) || 1, s = Math.sin(angle / 2);
  return [axis[0] / l * s, axis[1] / l * s, axis[2] / l * s, Math.cos(angle / 2)];
}

// rotations about the rig axes, in degrees (x: right, y: forward, z: up)
export const qx = (deg) => qaxis([1, 0, 0], deg * DEG);
export const qy = (deg) => qaxis([0, 1, 0], deg * DEG);
export const qz = (deg) => qaxis([0, 0, 1], deg * DEG);

export function qrot(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

export function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = d < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
  d = Math.abs(d);
  if (d > 0.9995) return qnorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
}

// the eased 0 → 1 a staged piece travels on inside its window [t0, t1] of the sequence
export function windowEase(t, t0, t1) {
  if (t <= t0) return 0;
  if (t >= t1) return 1;
  const u = (t - t0) / (t1 - t0);
  return u * u * (3 - 2 * u);
}
