/**
 * THE PATH, DESIGNED FROM THE TOP DOWN (docs/side-map-principles.md "The lane is a thing"): an across run's floor is not
 * one smooth trail. It is designed in three levels, each from the one above it.
 *
 *   the PROFILE   the run's shape, from what it is in the stage (its teaching or its beat) and where it leads: a rest
 *                 rises gently, the basics roll, a fight is fought on terraces, the dash keeps its runway level, a
 *                 gauntlet is broken ground, a landing is wide and flat after one rise; toward a climb it rises to the
 *                 climb's foot, toward a drop it falls to its lip (PATH_PROFILES, a row a profile)
 *   the BEATS     the profile laid along the run: a feature every so often (its `every`, a share of a screen, jittered by a
 *                 fifth either way: at most a screen and a fifth apart, inside the `varied` law's screen and a quarter), never
 *                 within a landing's length of a pit's lip or a dash's runway, so what the course teaches is untouched
 *   the FEATURES  a STEP (up or down by a hop: the running jump clears it with room) or a BLOCK (a raised stretch to fight
 *                 from or hop over: up, along, down), each changing the floor's height from there on, the height held
 *                 inside the frame the camera holds (from a sixth of a screen under the way in to a quarter over it)
 *
 *   PATH_PROFILES
 *   shapeRun(floors, { role, toward, W, H, J, LJ, gaps, dice }) → { floors, steps: [{ s, dz }] }
 *     floors  the run's floors as the course laid them ({ s0, s1, z }, the pits between), each cut where a feature
 *             changes its height, every floor after a feature at its new height (a pit keeps its own rise)
 *     steps   each feature's rise or drop where it stands (metres along the run)
 *
 * Pure and deterministic: the dice are the caller's (city/plan/dice.js streamOf).
 */
export const PATH_PROFILES = Object.freeze({
  rest: Object.freeze({ says: 'a breath: one gentle rise, the place shown', every: 1, kinds: ['step'], bias: 1, rise: [0.3, 0.5] }),
  basic: Object.freeze({ says: 'rolling ground: a step up or down every screen', every: 0.8, kinds: ['step'], bias: 0, rise: [0.4, 0.75] }),
  meet: Object.freeze({ says: 'terraces to fight on: a raised block to shoot from, a step between', every: 0.7, kinds: ['block', 'step'], bias: 0, rise: [0.45, 0.75] }),
  advanced: Object.freeze({ says: 'the dash\'s runways kept level; a step between them', every: 1, kinds: ['step'], bias: 0, rise: [0.4, 0.6] }),
  gauntlet: Object.freeze({ says: 'broken ground: steps and blocks every half screen', every: 0.5, kinds: ['block', 'step', 'step'], bias: 0, rise: [0.45, 0.8] }),
  landing: Object.freeze({ says: 'wide and flat after one rise: a place to stand and look', every: 99, kinds: ['step'], bias: 1, rise: [0.3, 0.45], once: true }),
  boss: Object.freeze({ says: 'one long floor for the fight', every: 99, kinds: [], bias: 0, rise: [0, 0] }),
  run: Object.freeze({ says: 'rolling ground', every: 0.9, kinds: ['step'], bias: 0, rise: [0.4, 0.7] }),
});
// (clear of a pit's lip, either side, and of a dash's runway before its gap; the least floor a feature stands on)
const CLEAR = 4, RUNWAY = 7, LEAST = 2.5;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** An across run's floors shaped from the top down. */
export function shapeRun(floors, { role = 'run', toward = 0, W, H, J, gaps = [], dice }) {
  const P = PATH_PROFILES[role] ?? PATH_PROFILES.run, lo = -H / 6, hi = H / 4;
  // (where a feature may stand: on a floor, clear of every lip, a dash's runway level)
  const blocked = (u) => gaps.some((g) => (u > g.s0 - (g.teaches === 'dash' ? RUNWAY : CLEAR) && u < g.s1 + CLEAR));
  const spots = [];
  const every = P.every * W;
  let next = P.once ? CLEAR + 2 : every * (0.6 + 0.4 * dice());
  for (const f of floors) {
    if (f.pillar) continue;
    for (let u = Math.max(next, f.s0 + CLEAR); u < f.s1 - CLEAR; u += 0.5) {
      if (u < next || blocked(u)) continue;
      spots.push(u); next = P.once ? Infinity : u + every * (0.8 + 0.4 * dice());
    }
  }
  // the features, in order: each a rise or drop from there on, its sign by the profile's lean and where the run leads,
  // held inside the frame
  const lean = Math.sign(P.bias + toward);
  let off = 0, k = 0;
  const changes = [];
  for (const u of spots) {
    const kind = P.kinds[k++ % P.kinds.length], h = r3(J * (P.rise[0] + (P.rise[1] - P.rise[0]) * dice()));
    if (!kind || !(h > 0)) continue;
    if (kind === 'block') {
      // a raised stretch: up, along, down (the floor after it as before)
      const len = r3(LEAST + 1.5 * dice());
      if (spots.some((v) => v > u && v < u + len + LEAST) || blocked(u + len) || off + h > hi) continue;
      changes.push({ s: u, dz: h }, { s: r3(u + len), dz: -h });
      continue;
    }
    // a step: up or down, the way the run leans, else alternating; turned back where it would leave the frame
    let sign = lean !== 0 ? lean : k % 2 ? 1 : -1;
    if (lean === 0 && dice() < 0.35) sign = -sign;
    if (off + sign * h > hi || off + sign * h < lo) sign = -sign;
    if (off + sign * h > hi || off + sign * h < lo) continue;
    off += sign * h;
    changes.push({ s: u, dz: r3(sign * h) });
  }
  // the floors cut at each change, every floor from there on at its new height
  const out = [], steps = [];
  let acc = 0, c = 0;
  changes.sort((a, b) => a.s - b.s);
  for (const f of floors) {
    let s0 = f.s0;
    while (c < changes.length && changes[c].s < f.s1 && changes[c].s >= f.s0) {
      const ch = changes[c++];
      if (ch.s - s0 > 1e-3) out.push({ ...f, s0: r3(s0), s1: r3(ch.s), z: r3(f.z + acc) });
      acc += ch.dz; s0 = ch.s;
      steps.push({ s: r3(ch.s), dz: ch.dz });
    }
    out.push({ ...f, s0: r3(s0), s1: f.s1, z: r3(f.z + acc) });
  }
  return { floors: out, steps };
}
