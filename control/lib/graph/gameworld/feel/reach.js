/**
 * THE REACH — what a feel's hero can cross, measured on the rule a game ships (its card lowered over the hero's own
 * platform rule, playscape/player.js, as gameworld/levels.js lays it) by playing that rule in the runtime itself on
 * scripted presses. A level is sized by it (a gap, a ledge, a drop), so a level and its feel cannot disagree: the
 * numbers are the game's, not a formula's.
 *
 *   MOVES      the moves measured, each a script of presses:
 *                hop    out of the run, the jump tapped (the shortest the button makes)
 *                stand  from a stand, the jump held and the stick pushed on the same frame
 *                run    out of the run at full speed, the jump held
 *                air    out of the run, held, the air jump pressed at the apex (a card with one: `airJumps`)
 *                dash   a dash jump: from a stand, the dash pressed and held, the jump a few frames into it (a feel
 *                       with its takes, whose card dashes and jumps out of it: `dash.jump`)
 *                airDash  out of the run, held, the air dash held from the apex (`dash.air`)
 *   the wall (a feel with its takes whose card clings: `cling`): `wall: { kick, climb }` — the metres a kick rises over
 *              the point it kicked from, and the height a kick gains on a single wall, kicked at once and held back to
 *              it (the climb of Mega Man X's wall)
 *   reachOf(feel) → { rule, speed, moves: { <move>: { height, long, air, arc } } }
 *                height  metres the feet rise to at the apex, over the take-off
 *                long    metres the body travels from the take-off to touching back down at the take-off's height:
 *                        the widest gap of level ground it clears, the body's centre at each lip
 *                air     seconds from the take-off to that touch-down
 *                arc     [[forward, up], …] each frame from the take-off (metres), down to DROP below it
 *              A move the card cannot make (an air jump on a card with none) is absent.
 *   reachAt(move, up) → metres forward where the arc comes down through `up` (above the take-off, negative below):
 *              the farthest ledge at that height it lands on; null where the arc never reaches it
 *
 * Pure and deterministic (the runtime's own step, a fixed frame); a few hundred frames a move.
 */
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';
import { playerWorld } from '../../playscape/player.js';
import { FPS, r4 } from './cards.js';
import { feelRule } from './lower.js';

const DT = 1 / FPS;
/** metres below the take-off the arcs are followed to */
export const DROP = 4;
export const MOVES = Object.freeze(['hop', 'stand', 'run', 'air', 'dash', 'airDash']);
// frames of run-up (the card's acceleration reaches its run well inside it) and the most a flight is followed
const RUN_UP = 90, MAX_AIR = 400;

/** The rule a game ships for this feel: the hero's own, the feel's card over it (no level's camera: the reach is along
 * the facing, which is the lane's along a side camera's line); no feel, the hero's own alone. */
export function shippedRule(feel) {
  return playerWorld({ heroRef: 'reach', ...(feel ? { rule: feelRule(feel) } : {}) }).entities[0].rule;
}

/** Play one move: `script(f, e)` → the input on frame f of the move (f 0 the press), `e` the body. */
function play(rule, { runUp, script }) {
  let open = false;   // once the body leaves the floor, the floor falls away: the flight is followed on, never cut short by it
  const world = { ground: () => (open ? -1e4 : 0) };
  const w = createWorld({ entities: [{ id: 'p', rule: { ...rule, eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] }), e = w.byId.p;
  for (let i = 0; i < 6; i++) stepWorld(w, {}, DT, world);   // settled on the floor
  for (let i = 0; i < runUp; i++) stepWorld(w, { forward: 1 }, DT, world);
  // (a lead-in on the floor before the move's own frames: a dash pressed before its jump)
  for (let i = 0; i < (script.lead ?? 0); i++) stepWorld(w, script(-script.lead + i, e), DT, world);
  let off = null; const arc = [];
  for (let f = 0; f < MAX_AIR; f++) {
    stepWorld(w, script(f, e), DT, world);
    const [x, , z] = e.transform.pos;
    if (!off && !e.grounded && z > 1e-6) { off = { x: x - e.vel[0] * DT, z: 0, f }; open = true; arc.push([0, 0]); }
    if (off) { arc.push([r4(x - off.x), r4(z - off.z)]); if (z - off.z < -DROP) break; }
  }
  if (!off) return null;
  return arc;
}

/** The arc's touch-down at `up` on its way down: metres forward, interpolated between frames; null where it never
 * reaches that height, or never comes down through it. */
export function reachAt(move, up) {
  const A = move?.arc; if (!A) return null;
  const top = A.reduce((i, p, k) => (p[1] > A[i][1] ? k : i), 0);
  if (up > A[top][1]) return null;
  for (let k = Math.max(top, 1); k < A.length; k++) {
    const [x0, z0] = A[k - 1], [x1, z1] = A[k];
    if (z0 >= up && z1 < up) return r4(x0 + ((x1 - x0) * (z0 - up)) / (z0 - z1));
  }
  return null;
}

const measure = (arc) => {
  if (!arc) return null;
  const height = r4(Math.max(...arc.map((p) => p[1])));
  const long = reachAt({ arc }, 0), down = arc.findIndex((p, k) => k > 1 && p[1] < 0);
  return { height, long, air: r4((down > 0 ? down - 1 : arc.length) * DT), arc };
};

/** The wall: a body run at a wall, clung, then kicked off it at once and held back to it, kick after kick: the height a
 * kick rises over its point and the mean height each kick gains. */
function wallOf(rule) {
  const W = 3, world = { ground: () => 0 };
  const w = createWorld({ colliders: [{ min: [W, -50, 0], max: [W + 0.6, 50, 200] }], entities: [{ id: 'p', rule: { ...rule, eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] }), e = w.byId.p;
  for (let i = 0; i < 6; i++) stepWorld(w, {}, DT, world);
  const clungAt = [], rises = []; let last = -99, from = null, top = -Infinity;
  for (let f = 0; f < 600 && clungAt.length < 5; f++) {
    const kick = !!e.cling && f - last > 2 && f > 20;
    if (kick) { clungAt.push(e.transform.pos[2]); if (from !== null) rises.push(top - from); from = e.transform.pos[2]; top = from; last = f; }
    stepWorld(w, { forward: 1, jump: f === 10 || kick, jumpHeld: true }, DT, world);
    if (from !== null) top = Math.max(top, e.transform.pos[2]);
  }
  if (clungAt.length < 3) return null;
  const gains = clungAt.slice(1).map((z, i) => z - clungAt[i]);
  return { kick: r4(Math.max(...rises)), climb: r4(gains.reduce((a, b) => a + b, 0) / gains.length) };
}

/** Each move's reach for a feel, on the rule its game ships. */
export function reachOf(feel) {
  const rule = shippedRule(feel);
  const held = (f) => ({ forward: 1, jump: f === 0, jumpHeld: true });
  let apex = null;
  const moves = {
    hop: measure(play(rule, { runUp: RUN_UP, script: (f) => ({ forward: 1, jump: f === 0, jumpHeld: f === 0 }) })),
    stand: measure(play(rule, { runUp: 0, script: held })),
    run: measure(play(rule, { runUp: RUN_UP, script: held })),
    // the air jump at the apex: the first frame the rise is spent
    ...((rule.airJumps ?? 0) > 0 ? { air: measure(play(rule, { runUp: RUN_UP, script: (f, e) => {
      const at = apex === null && f > 0 && !e.grounded && e.vel[2] <= 0;
      if (at) apex = f;
      return { forward: 1, jump: f === 0 || at, jumpHeld: true };
    } })) } : {}),
  };
  // the dash's: a dash jump out of a dash from a stand, an air dash held from the apex
  const D = rule.dash;
  if (D?.jump) { const lead = 4, sc = (f) => ({ forward: 1, boost: true, jump: f === 0, jumpHeld: true }); sc.lead = lead; moves.dash = measure(play(rule, { runUp: 0, script: sc })); }
  if (D?.air) {
    let at = null;
    moves.airDash = measure(play(rule, { runUp: RUN_UP, script: (f, e) => {
      if (at === null && f > 0 && !e.grounded && e.vel[2] <= 0) at = f;
      return { forward: 1, jump: f === 0, jumpHeld: true, boost: at !== null && f >= at };
    } }));
  }
  for (const k of Object.keys(moves)) if (!moves[k]) delete moves[k];
  const wall = rule.cling ? wallOf(rule) : null;
  return { rule, speed: rule.speed, moves, ...(wall ? { wall } : {}) };
}
