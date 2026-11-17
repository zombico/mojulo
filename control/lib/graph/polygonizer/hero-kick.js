/**
 * hero-kick — SCOPED ACTIONS, the legs': KICKS out of the fist's guard (hero-strike.js: its ready stance, the right foot
 * leading), each a timeline on the jump's own curves (hero-jump.js keyedClip: every channel a cubic through its keys,
 * the planted foot held on the floor, the free one glided off it and back), never keyed frame by frame:
 *
 *   GUARD → LOAD → CHAMBER → STRIKE → HOLD → RETRACT → GUARD
 *
 *   • THE STANDING LEG is the lead (right) leg: planted throughout, its knee soft, the body's weight settled onto it in
 *     the load. THE KICKING LEG is the rear (left): off the floor from the chamber to the retract.
 *   • THE CHAMBER: the thigh lifted and the knee folded, the kick's shape made before it goes; the strike is the knee
 *     opening from there (a snap), the foot fastest as it lands. A kick comes back through its chamber: never a swing
 *     dropped to the floor.
 *   • THE COUNTER: the trunk leans back off a straight kick, away from a round one; the rear arm swings back against the
 *     leg; the eyes stay on the target (the guard's own glance).
 *   • It starts and ends on the guard's held pose, so it chains with the punches with no step between.
 *
 * The three: `frontKick` (the thigh up, the foot driven straight out at the belly), `roundKick` (the thigh out to the
 * side, the hips turned over, the shin swung across at the ribs) and `knee` (the thigh driven up and in, the trunk
 * pulled over it). A kick gives its clip, its contact (time) and the foot that lands it (`hand`: the leg's side, as a
 * strike says its hand).
 *
 *   KICKS / KICK_NAMES
 *   heroKick(name, R, { seconds? }) → { name, from: 'guard', hand, seconds, clip, keys, contact: { t } }
 * Pure and deterministic.
 */
import { keyedClip } from './hero-jump.js';
import { heroStrike } from './hero-strike.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The kicks: seconds, the phases' times (shares of the clip) and, at the chamber and at the strike, what moves off the
 *  guard: the kicking hip and knee, the trunk's hinge (+ forward), the body's facing (+ the hips turned over, degrees),
 *  the rear arm's counter-swing (degrees its shoulder pitches back) and the sink of the standing leg (metres). */
export const KICKS = Object.freeze({
  // (the rig's hip flexes 62° at most, figure-vajra's limit: these are kicks at the thigh and the body's low line, the
  // foot at knee height and a leg's length out, never a head kick)
  frontKick: { seconds: 0.6, timing: { load: 0.14, chamber: 0.34, contact: 0.5, hold: 0.57, retract: 0.76 },
    chamber: { hip: { pitch: 62 }, knee: 118, hinge: -2, facing: -34, arm: 12, sink: 0.03 },
    strike: { hip: { pitch: 62 }, knee: 4, hinge: -12, facing: -48, arm: 30, sink: 0.01 }, serves: ['front kick', 'push kick', 'teep'] },
  roundKick: { seconds: 0.78, timing: { load: 0.12, chamber: 0.3, contact: 0.54, hold: 0.6, retract: 0.8 },
    chamber: { hip: { pitch: 58, yaw: 58 }, knee: 122, hinge: -2, facing: -18, arm: 15, sink: 0.03 },
    strike: { hip: { pitch: 62, yaw: -12 }, knee: 8, hinge: -8, facing: -62, arm: 38, sink: 0.01 }, serves: ['roundhouse', 'round kick', 'low kick'] },
  knee: { seconds: 0.5, timing: { load: 0.16, chamber: 0.36, contact: 0.5, hold: 0.58, retract: 0.76 },
    chamber: { hip: { pitch: 50 }, knee: 126, hinge: 6, facing: -36, arm: -18, sink: 0.02 },
    strike: { hip: { pitch: 62 }, knee: 138, hinge: 18, facing: -48, arm: -32, sink: 0 }, serves: ['knee', 'knee strike'] },
});
export const KICK_NAMES = Object.keys(KICKS);

// the guard a kick is thrown from, a rig's own (the jab's first key: hero-strike.js stands it), once a rig
const GUARDS = new WeakMap();
const guardOf = (R) => { if (!GUARDS.has(R)) GUARDS.set(R, heroStrike('jab', R).keys[0]); return GUARDS.get(R); };

/** A kick on a rig. */
export function heroKick(name, R, { seconds = null } = {}) {
  const K = KICKS[name];
  if (!K) throw new Error(`hero-kick: no kick '${name}' (have ${KICK_NAMES.join(', ')})`);
  const G = guardOf(R), T = seconds ?? K.seconds, tm = K.timing, leg = 'L';
  // a key off the guard: the kicking leg's hip and knee, the trunk, the facing, the rear arm, the free foot off the floor
  const key = (t, P, air) => ({
    ...G, t,
    pose: {
      ...G.pose, [`hip${leg}`]: { ...P.hip }, [`knee${leg}`]: P.knee,
      hinge: (G.pose.hinge ?? 0) + P.hinge, facing: (G.pose.facing ?? 0) + P.facing,
      [`sh${leg}`]: { ...G.pose[`sh${leg}`], pitch: (G.pose[`sh${leg}`]?.pitch ?? 0) - P.arm },
    },
    sink: (G.sink ?? 0) + P.sink, [`ground${leg}`]: air ? 0 : 1, [`heel${leg}`]: air ? 0 : G[`heel${leg}`],
  });
  // the load: the weight settled onto the standing leg, the rear heel peeling up, nothing off the floor yet
  const load = { ...G, t: tm.load, sink: (G.sink ?? 0) + 0.025, [`heel${leg}`]: Math.max(G[`heel${leg}`] ?? 0, 34) };
  const keys = [{ ...G, t: 0 }, load, key(tm.chamber, K.chamber, true), key(tm.contact, K.strike, true), key(tm.hold, K.strike, true), key(tm.retract, K.chamber, true), { ...G, t: 1 }];
  const clip = keyedClip({ seconds: T, keys }, R);
  return { name, from: 'guard', hand: leg, seconds: T, clip, keys, contact: { t: r4(tm.contact * T) }, serves: [...K.serves] };
}
