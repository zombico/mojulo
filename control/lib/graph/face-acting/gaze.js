/**
 * gaze — THE EYES' LAW: two eyes look at one thing. A gaze is a target (a direction, yaw and pitch from between the
 * eyes, and a distance), and each eye's turn is the line from that eye to it:
 *
 *   • the eyes move TOGETHER (conjugate): one direction for both, never each its own;
 *   • they CONVERGE only as far as the target is near, and never nearer than `EYES.near` asks (a face is never
 *     cross-eyed: what is closer than that the eyes give up on, as a person's do);
 *   • they never DIVERGE (wall-eyed: past parallel, a target farther than infinity) nor SKEW (one up, one down);
 *   • a gaze with no distance looks at the FAR POINT: the eyes parallel, the gaze of someone looking at nothing;
 *   • FOCUS changes slowly (`EYES.verge`): a saccade jumps the direction in a twentieth of a second, the convergence
 *     follows over a quarter; a take carries it per frame as `gaze.vergence` (degrees), where any fixation focuses.
 *
 * Degrees throughout: +yaw the figure's right, +pitch up; an eye's own yaw likewise (the left eye's toward the nose is
 * +yaw). `gazeFaults` reads a frame's two eyes against the law (a capture's, a hand-held channel's); `seatGaze` puts a
 * frame back on it. The rig turns degrees to look weights and back (relational-face-rig.js `eyeWeights`,
 * `eyesOfWeights`). Pure arithmetic.
 */

/** the eyes: their spacing (m, the interpupillary distance), the nearest target they converge on (m), the tolerance
 * (degrees) a frame's eyes may stray from the law before it is a fault (a capture's noise, a key's rounding), and how
 * long a change of focus takes (s: vergence is slow beside a saccade, a quarter of a second against a twentieth) */
export const EYES = Object.freeze({ ipd: 0.063, near: 0.4, tolerance: 0.5, verge: 0.25 });

const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;

/** the eyes' convergence (degrees, the two eyes' yaws apart) on a target `distance` metres off: 0 at the far point,
 * the near point's at most */
export function vergence(distance = Infinity) {
  if (!(distance < Infinity)) return 0;
  return 2 * deg(Math.atan(EYES.ipd / 2 / Math.max(EYES.near, distance)));
}
export const MAX_VERGENCE = vergence(EYES.near);
/** a convergence (degrees) → the distance it focuses at (m): 0 or less the far point */
export function distanceOf(v = 0) {
  return v > 1e-9 ? EYES.ipd / 2 / Math.tan(rad(Math.min(v, MAX_VERGENCE) / 2)) : Infinity;
}

/**
 * A gaze → each eye's turn: { L: { yaw, pitch }, R: { yaw, pitch } } (L the figure's left eye). No distance (or an
 * infinite one): both eyes the gaze itself, parallel. A distance nearer than the near point is the near point's.
 */
export function eyeTurns(yaw = 0, pitch = 0, distance = Infinity) {
  if (!(distance < Infinity)) return { L: { yaw, pitch }, R: { yaw, pitch } };
  // (the target from between the eyes: +x the figure's right, +y up, +z ahead; each eye at its half of the spacing)
  const d = Math.max(EYES.near, distance), y = rad(yaw), p = rad(pitch);
  const T = [d * Math.sin(y) * Math.cos(p), d * Math.sin(p), d * Math.cos(y) * Math.cos(p)];
  const eye = (x) => ({ yaw: deg(Math.atan2(T[0] - x, T[2])), pitch: deg(Math.atan2(T[1], Math.hypot(T[0] - x, T[2]))) });
  return { L: eye(-EYES.ipd / 2), R: eye(EYES.ipd / 2) };
}

/**
 * A frame's two eyes ({ L: { yaw, pitch }, R: … }) against the law → its faults ([] on the law): 'crossed' (converging
 * past the near point's), 'wall-eyed' (diverging), 'skewed' (one eye up and the other down), each past `EYES.tolerance`.
 */
export function gazeFaults(eyes) {
  const v = eyes.L.yaw - eyes.R.yaw, faults = [];
  if (v > MAX_VERGENCE + EYES.tolerance) faults.push('crossed');
  if (v < -EYES.tolerance) faults.push('wall-eyed');
  if (Math.abs(eyes.L.pitch - eyes.R.pitch) > EYES.tolerance) faults.push('skewed');
  return faults;
}

/**
 * A frame's two eyes put back on the law: the direction their mean, the convergence clamped to [0, the near point's],
 * the pitch their mean. A frame already on it comes back as it was.
 */
export function seatGaze(eyes) {
  if (!gazeFaults(eyes).length) return eyes;
  const yaw = (eyes.L.yaw + eyes.R.yaw) / 2, pitch = (eyes.L.pitch + eyes.R.pitch) / 2;
  const v = Math.max(0, Math.min(MAX_VERGENCE, eyes.L.yaw - eyes.R.yaw));
  return { L: { yaw: yaw + v / 2, pitch }, R: { yaw: yaw - v / 2, pitch } };
}
