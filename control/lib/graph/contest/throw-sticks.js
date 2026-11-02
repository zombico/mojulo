/**
 * throw-sticks — the throw library as a contest page plays it: a stick (contest/athlete-pose.js's joints, the athlete
 * posed by their directions on its own lengths) at any moment of a technique, turned to the thrower's facing and set on
 * its spot, the ball in the hand until it leaves, and the launch a sim gives the ball (the library's real release: speed,
 * elevation, spin) from where the hand let it go. The frames are baked from the manual manipulator's solve
 * (polygonizer/hero-throw.js, hero-throw-bake.js; scripts/throw-sticks.mjs), so a page plays a throw without the solver.
 *
 *   throwStick(name, u, { at, face, ground })   → { stick, ball (its centre while held, else null), released (bool) }
 *   throwRelease(name, { at, face, ground, power, toward })   → { position, velocity, angularVelocity, u, seconds }
 *     `power` scales the speed (0.5 … 1.2 of the technique's), `toward` a point the elevation is aimed through (else the
 *     technique's own); the spin's axis is the technique's in the thrower's frame, turned with it.
 *   THROW_STICK_NAMES, throwOf(name)
 * Pure; no dice, no clock (a sim passes its own time as `u`).
 */
import { THROW_STICKS, THROW_STICK_JOINTS } from './throw-sticks.data.js';

export const THROW_STICK_NAMES = Object.freeze(Object.keys(THROW_STICKS));
export const throwOf = (name) => { const T = THROW_STICKS[name]; if (!T) throw new Error(`throw-sticks: no throw '${name}' (have ${THROW_STICK_NAMES.join(', ')})`); return T; };
const SPIN = { back: [-1, 0, 0], top: [1, 0, 0], side: [0, 0, 1], along: [0, 1, 0] };

/** the thrower's frame turned to `face` ([x, y] on the floor: where the target lies) and set on `at` */
function placer(at, face, ground) {
  const l = Math.hypot(face[0], face[1]) || 1, fy = [face[0] / l, face[1] / l], fx = [fy[1], -fy[0]];
  return {
    point: (q) => [at[0] + (fx[0] * q[0] + fy[0] * q[1]) / 1000, at[1] + (fx[1] * q[0] + fy[1] * q[1]) / 1000, (at[2] ?? ground) + q[2] / 1000],
    dir: (v) => [fx[0] * v[0] + fy[0] * v[1], fx[1] * v[0] + fy[1] * v[1], v[2]],
  };
}

/** The stick at share `u` (0 … 1) of a technique: the frames on either side blended, turned and set (see the head). */
export function throwStick(name, u, { at = [0, 0, 0], face = [0, 1], ground = 0 } = {}) {
  const T = throwOf(name), F = T.frames, x = Math.max(0, Math.min(1, u)) * (F.length - 1), i = Math.min(F.length - 2, Math.floor(x)), t = x - i;
  const P = placer([at[0], at[1], ground + 0.92 + (at[2] ?? 0) - ground], face, ground);
  const lerp = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const stick = {};
  THROW_STICK_JOINTS.forEach((k, j) => { stick[k] = P.point(lerp(F[i][j], F[i + 1][j])); });
  const n = THROW_STICK_JOINTS.length, b0 = F[i][n], b1 = F[i + 1][n];
  const released = u > T.release.u;
  return { stick, ball: !released && b0 ? P.point(b1 ? lerp(b0, b1) : b0) : null, released };
}

/** The ball's launch from the hand (see the head). With `toward`, the thrower turns to it and the elevation is the low
 * arc (in a vacuum, g 9.81) that carries the ball through it at its speed; a point out of its reach keeps the
 * technique's own elevation. */
export function throwRelease(name, { at = [0, 0, 0], face = [0, 1], ground = 0, power = 1, toward = null } = {}) {
  const T = throwOf(name), k = Math.max(0.5, Math.min(1.2, power)), speed = T.release.spec.speed * k;
  const facing = toward ? [toward[0] - at[0], toward[1] - at[1]] : face;
  const P = placer([at[0], at[1], ground + 0.92 + (at[2] ?? 0) - ground], Math.hypot(...facing) > 1e-9 ? facing : face, ground);
  const position = P.point(T.release.at);
  let el = (T.release.spec.elevation * Math.PI) / 180;
  if (toward) {
    const x = Math.hypot(toward[0] - position[0], toward[1] - position[1]), y = toward[2] - position[2], g = 9.81, v2 = speed * speed;
    const disc = v2 * v2 - g * (g * x * x + 2 * y * v2);
    if (x > 1e-6 && disc >= 0) el = Math.atan2(v2 - Math.sqrt(disc), g * x);
  }
  const fwd = P.dir([0, Math.cos(el), Math.sin(el)]), axis = P.dir(SPIN[T.release.spec.spin.axis] ?? SPIN.back), w = 2 * Math.PI * T.release.spec.spin.rps * k;
  return { position, velocity: fwd.map((v) => v * speed), angularVelocity: axis.map((v) => v * w), elevation: (el * 180) / Math.PI, u: T.release.u, seconds: T.seconds };
}
