/**
 * hero-solid — THE BODY KEPT SOLID under its own arms: a clip's arms never pass deeper into the trunk than its starting
 * stance holds them. Curves through keys interpolate each shoulder's pitch, swing and roll on their own, so an arm moving
 * between two clear poses can take a path through the chest (a hit taken in the guard, its arm flung back across the
 * body; seen in a bout).
 *
 *   • THE MEASURE is hero-grip's `armClear`: each arm's upper arm and forearm against the trunk's capsule (the pelvis to
 *     the neck, its radius from the shoulders' span), on the skeleton. It is conservative (a guard's forearm in front of
 *     the sternum reads a few centimetres in), so the FLOOR is the clip's own first frame for each arm, never deeper
 *     than the stance it starts from, less `slack`.
 *   • THE CORRECTION, per frame: an arm past its floor has its shoulder turned the least that brings it back (its swing
 *     and pitch, Levenberg–Marquardt on the shortfall, a degree weighing `w`), the rest of the pose as it was. A frame
 *     within its floor is the clip's own, untouched.
 *
 *   solidArms(R, fn, { sides?, slack?, w? }) → fn'   the clip's pose function kept solid (fn' carries `solid`: the floors)
 *   solidRead(R, fn, n = 60) → { R: { worst, t, floor }, L: … }   the deepest each arm goes past its floor (m, + inside)
 *
 * Pure and deterministic (no dice; the solve is seeded at the frame's own pose).
 */
import { rigNodesAt } from './station-loft-rig.js';
import { armClear, lm } from './hero-lm.js';

const SIDES = ['R', 'L'];

/** each arm's floor: its clearance at the clip's start, less the slack */
const floorsOf = (R, fn, sides, slack) => { const n = rigNodesAt(R, fn(0)).nodes; return Object.fromEntries(sides.map((S) => [S, Math.min(0, armClear(R, n, S)) - slack])); };

export function solidArms(R, fn, { sides = SIDES, slack = 0.005, w = 0.002 } = {}) {
  const floor = floorsOf(R, fn, sides, slack);
  const out = (t) => {
    let pose = fn(t), n = rigNodesAt(R, pose).nodes;
    for (const S of sides) {
      if (armClear(R, n, S) >= floor[S]) continue;
      const sh = pose[`sh${S}`] ?? {}, base = { pitch: sh.pitch ?? 0, yaw: sh.yaw ?? 0, roll: sh.roll ?? 0 };
      const at = (x) => ({ ...pose, [`sh${S}`]: { ...sh, pitch: base.pitch + x[0], yaw: base.yaw + x[1] } });
      const f = (x) => { const c = armClear(R, rigNodesAt(R, at(x)).nodes, S); return [Math.max(0, floor[S] - c) * 100, x[0] * w, x[1] * w]; };
      const { x } = lm(f, [0, 0], [-45, -60], [45, 60], 25);
      pose = at(x.map((v) => Math.round(v * 100) / 100)); n = rigNodesAt(R, pose).nodes;
    }
    return pose;
  };
  out.solid = floor;
  return out;
}

/** the deepest each arm goes past its floor over `n` frames (metres; 0 when it never does) */
export function solidRead(R, fn, n = 60, { slack = 0.005 } = {}) {
  const floor = floorsOf(R, fn, SIDES, slack), out = Object.fromEntries(SIDES.map((S) => [S, { worst: 0, t: 0, floor: floor[S] }]));
  for (let i = 0; i <= n; i++) {
    const nodes = rigNodesAt(R, fn(i / n)).nodes;
    for (const S of SIDES) { const d = floor[S] - armClear(R, nodes, S); if (d > out[S].worst) out[S] = { ...out[S], worst: Math.round(d * 1e4) / 1e4, t: i / n }; }
  }
  return out;
}
