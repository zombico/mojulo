/**
 * THE ROLLED COURSE — an obstacle course for a hero that runs on momentum (a feel on the pinball base), sized by TIME
 * and laid so that a seed picks what stands at each of its places. A platformer's course is sized in space, by its
 * hero's reach (feel/reach.js, course.js). A momentum hero's is sized by what each ask NEEDS in seconds, which is
 * measured on the rule the game ships, and by how far ahead the player can see:
 *
 *     the sight an ask wants = (its need + the player's reaction) × the hero's speed
 *
 * Seen from behind the hero, on three lanes. THE PRIMITIVES, each an ask:
 *   hurdle   a low bar across the whole way: jump (a wide window)
 *   block    a longer, higher box across it: jump (a tighter window)
 *   posts    a wall across two lanes, too tall to jump, an outer lane left open: be in that lane
 *
 * A course is SLOTS along a lane, one every `gap` metres: the hero's top speed × (the neediest ask's need + a rest), so
 * whatever a seed stands in a slot, the player has had time for it. Its slots are one LINE of a roll's pattern
 * (game/roll.js): of each slot's hurdle, block and two walls of posts exactly one stands, and the line is PACED: never
 * more than two asks of one kind running (go over, go round), never a pair of kinds repeated, never the same posts
 * twice running (the second would ask nothing), and it opens on the wide windows and tightens (hurdles weigh most at
 * its start, blocks at its end). Every roll of it is fair by how it is laid, and paced by how it is rolled.
 *
 *   paceOf(feel)          → { top, steerSign, lead: { hurdle, block: { late, early, mid, frames } }, laneTime: [0, s, s] }
 *                           the hero measured, kept by its feel: its top speed, each jump's lead in seconds (the
 *                           window's two ends and middle) and a lane change's time, steered as a player learns to
 *   courseOf(G, { slots?, rest?, react? }) → { pace, need, gap, sight, length, slots: [{ k, y, of: { <thing id>: prim } }],
 *                           blocks, roll, exit, start, colliders, faces }: the course laid for this world's hero
 *   playCourse(course, { seed?, react?, sight?, seconds? }) → { finished, seconds, hits, clean, retries }: one seed
 *                           played by THE REACTION BOT. It knows how to play; what it lacks is what a player lacks: it
 *                           SEES a thing only inside `sight` metres ahead and ACTS on it only `react` seconds after it
 *                           first saw it. Stopped, it backs off for a run-up and comes again. `trace: true` adds
 *                           `line`: where it went ([[along, across, in the air], …])
 *   courseAudit(course, { seeds? }) → { seeds, laws: [{ law, holds, says }], ok }: the machine gate over a sample of seeds
 *     fair       a player who reacts in `react` s and sees `sight` m runs every sampled seed clean (no hit)
 *     finishes   a slow player (0.8 s) who sees the same still finishes every sampled seed
 *     paced      no sampled course runs three asks of one kind, repeats a pair of kinds, or asks the same posts twice
 *     apart      the sample is not one course
 *   courseOfLevel(manifest) → the course read back off a level that is one (its `obstacles`, its blocks, its roll, its
 *                           pilot's own rule), so a made level is audited by the bot as the room's is
 *   readObstacles(v)      → { slots, rest } checked (a level's `obstacles`: true | { slots?, rest? }), teaching
 *   obstacleStage(G, v)   → a level's stage (gameworld/levels.js): the lane, its slots' things and the roll over them,
 *                           sized for the world's hero; obstacleEnds(manifest) → its anchors (start, exit, flat ground)
 *   PRIMITIVES, LANES, REACT, REST
 *
 * THE DRESS (course-dress.js): the way and its asks are coloured by role from a theme (`dress`: 'rail-yard' unsaid),
 * and each ask carries its tell: a jump's window painted as a strip, posts' arrows toward the open lane. A tell is
 * part of its ask's rolled thing, so it is on the way only when the ask is.
 *
 * The bot is the same on every run: it finds what is possible for a reaction and a sight, not what is comfortable.
 * Flat ground, three primitives; no gap, ramp or crest yet. Pure and deterministic.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { feelRule } from './feel/lower.js';
import { readRoll, rolledIds, rollWays } from '../game/roll.js';
import { standBlocks } from '../playscape/terrain.js';
import { dressOf, ASK_ROLE } from './course-dress.js';
import { hexToRgb } from '../color-theorist/oklab.js';
import { courseCamera } from './course-view.js';
import { rhythmFaults } from '../era/wall-rhythm.js';

export const LANES = Object.freeze([-2, 0, 2]);
const HALF = 3.3, DT = 1 / 60;
/** The exit's catch: the whole width of the lane, kerb to kerb (a hero ends its run in whichever lane the last ask left
 * it, or against a kerb: a disc on the centre line would let it run past the end of the course). */
export const EXIT_HALF = Object.freeze([HALF + 1, 1.5, 40]);
export const REACT = 0.4, REST = 0.6;
// how each ask is weighed along the line, first slot to last: it opens on the wide windows and tightens
export const RAMP = Object.freeze({ hurdle: [4, 2], block: [1, 4], 'posts-left': [2, 2], 'posts-right': [2, 2] });
// (posts: a wall over two lanes, the open lane's index beside it)
export const PRIMITIVES = Object.freeze({
  hurdle: { ask: 'jump', len: 0.7, h: 0.75 },
  block: { ask: 'jump', len: 1.4, h: 1 },
  'posts-left': { ask: 'steer', len: 0.6, h: 3, open: 0, x: 1 },    // the left lane open: the wall over the middle and right
  'posts-right': { ask: 'steer', len: 0.6, h: 3, open: 2, x: -1 },
});

let E = null;
const live = () => (E ??= composeLive());
const hooks = { ground: () => 0 };
const ruleOf = (feel) => ({ type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(feel != null ? feelRule(feel) : {}) });
const heroOf = (rule, y = 0) => ({ id: 'hero', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [0, y, 0], heading: Math.PI / 2 } });
// steering has momentum too: push toward the lane, then push back in time to stop on it (the way it would still slide)
const steer = (rule, x, vx, want, sign) => { const slide = (vx * Math.abs(vx)) / (2 * (rule.accel || 7)), e = want - (x + slide); return Math.abs(e) > 0.12 ? Math.sign(e) * sign : 0; };

const PACES = new Map();
/** The pace of a feel's hero (see the header); `paceOfRule` the same for a rule as a level holds it. */
export const paceOf = (feel) => paceOfRule(ruleOf(feel));
export function paceOfRule(rule) {
  const key = JSON.stringify(rule);
  if (PACES.has(key)) return PACES.get(key);
  const N = live();
  const spawn = (colliders, y = 0) => { const w = N.createWorld({ entities: [heroOf(rule, y)], colliders }); return { w, me: w.byId.hero }; };
  const a = spawn([]); let prev = 0, top = 0;
  for (let f = 0; f < 600; f++) { N.stepWorld(a.w, { forward: 1 }, DT, hooks); top = Math.max(top, (a.me.transform.pos[1] - prev) / DT); prev = a.me.transform.pos[1]; }
  const x0 = a.me.transform.pos[0];
  for (let f = 0; f < 20; f++) N.stepWorld(a.w, { forward: 1, strafe: 1 }, DT, hooks);
  const steerSign = Math.sign(a.me.transform.pos[0] - x0) || 1;
  // each jump's window: the jump pressed d metres short of it, from top speed (a run-up that reaches it)
  const run = Math.max(30, Math.ceil(top * 4)), lead = {};
  for (const [id, P] of Object.entries(PRIMITIVES)) {
    if (P.ask !== 'jump') continue;
    const ok = [];
    for (let d = 0.2; d <= Math.max(6, top); d += 0.2) {
      const { w, me } = spawn([{ min: [-HALF, run, 0], max: [HALF, run + P.len, P.h] }]);
      let pressed = 0, over = false;
      for (let f = 0; f < 60 * 12 && !over; f++) {
        const inp = { forward: 1 };
        if (!pressed && run - me.transform.pos[1] <= d) pressed = 1;
        if (pressed && pressed <= 2) { inp.jump = 1; pressed++; }
        if (pressed) inp.jumpHeld = 1;
        N.stepWorld(w, inp, DT, hooks);
        over = me.transform.pos[1] > run + P.len + 2;
      }
      if (over) ok.push(d);
    }
    lead[id] = ok.length ? { late: ok[0] / top, early: ok[ok.length - 1] / top, mid: (ok[0] + ok[ok.length - 1]) / 2 / top, frames: Math.round(((ok[ok.length - 1] - ok[0]) / top) * 60) } : null;
  }
  const laneTime = [0, 2, 4].map((d) => {
    if (!d) return 0;
    const { w, me } = spawn([]);
    for (let f = 0; f < 400; f++) N.stepWorld(w, { forward: 1 }, DT, hooks);
    let px = me.transform.pos[0];
    for (let f = 0; f < 900; f++) {
      const x = me.transform.pos[0], vx = (x - px) / DT; px = x;
      if (Math.abs(x - d) < 0.5) return f * DT;
      const s = steer(rule, x, vx, d, steerSign);
      N.stepWorld(w, { forward: 1, ...(s ? { strafe: s } : {}) }, DT, hooks);
    }
    return Infinity;
  });
  const out = { top, steerSign, lead, laneTime };
  PACES.set(key, out);
  if (PACES.size > 16) PACES.delete(PACES.keys().next().value);
  return out;
}

const r2 = (v) => Math.round(v * 100) / 100;

export function courseOf(G, { slots = 10, rest = REST, react = REACT, dress = 'rail-yard' } = {}) {
  // THE DRESS (course-dress.js): the way and its asks coloured by role, and each ask's tell painted before it
  const D = dressOf(dress, Number.isFinite(G?.seed) ? G.seed : 1), col = D.palette, tint = (role) => hexToRgb(col[role]).map((v) => Math.round((v / 255) * 1e4) / 1e4);
  const quad = (x0, y0, x1, y1, z, fill) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill });
  const feel = G?.feel ?? null, rule = ruleOf(feel), pace = paceOfRule(rule);
  // the primitives this hero can be asked: a jump it cannot make is left out of the course
  const prims = Object.keys(PRIMITIVES).filter((id) => PRIMITIVES[id].ask !== 'jump' || pace.lead[id]);
  // the neediest ask: a two-lane change, or a jump's earliest lead
  const need = Math.max(pace.laneTime[2], ...prims.filter((id) => PRIMITIVES[id].ask === 'jump').map((id) => pace.lead[id].early));
  const gap = r2(pace.top * (need + rest)), runup = Math.max(16, Math.ceil(gap)), blocks = [], lineSlots = [], kinds = {}, forms = {}, list = [];
  for (let k = 0; k < slots; k++) {
    const y = r2(runup + k * gap), of = {};
    for (const id of prims) {
      const P = PRIMITIVES[id], bid = `s${k + 1}-${id}`;
      of[bid] = id; kinds[bid] = P.ask === 'jump' ? 'over' : 'round'; forms[bid] = id;
      // (a wall form, playscape/terrain.js: across the way, `thick` along it; its `at` the middle of its foot)
      // its TELL, painted on the way and rolled with it: a jump's window as a strip (from the earliest place a jump
      // still clears it to the latest), posts' arrows in the lanes they stand in, from where a two-lane change begins
      const marks = [];
      if (P.ask === 'jump') marks.push(quad(-HALF, r2(y - pace.lead[id].early * pace.top), HALF, r2(y - pace.lead[id].late * pace.top), 0.02, col['tell-jump']));
      else {
        const to = Math.sign(LANES[P.open]), from = r2(y - pace.top * pace.laneTime[2]);
        for (const lane of LANES.filter((_, i) => i !== P.open)) for (const ay of [from, r2((from + y) / 2)]) {
          // (an arrow: a shaft and a head, pointing across the way at the open lane)
          marks.push(quad(lane - 0.55, ay - 0.16, lane + 0.25, ay + 0.16, 0.02, col['tell-steer']));
          marks.push({ corners: [[lane + to * 0.25, ay - 0.5, 0.02], [lane + to * 0.85, ay, 0.02], [lane + to * 0.25, ay + 0.5, 0.02]], fill: col['tell-steer'] });
          if (to < 0) { const q = marks[marks.length - 2]; q.corners = quad(lane - 0.25, ay - 0.16, lane + 0.55, ay + 0.16, 0.02).corners; }
        }
      }
      blocks.push({ id: bid, form: 'wall', at: [P.ask === 'steer' ? P.x : 0, r2(y + P.len / 2), 0], N: [0, -1], length: P.ask === 'steer' ? 4 : 2 * HALF, height: P.h, thick: P.len, value: 0.62, tint: tint(ASK_ROLE[id]), marks });
    }
    lineSlots.push(Object.keys(of));
    list.push({ k, y, of });
  }
  const length = r2(runup + slots * gap + 6), exit = [0, length - 3, 0];
  // the lane, by role: its floor in 2 m tiles (two tones by turns), its kerbs and low walls drawn where they stand, and
  // what the theme's lanes are (a rail yard's sleepers and rails: flat paint, never a thing in the way), the exit's line
  const faces = [], tile = 2, W = HALF + 1, add = (q, group) => faces.push({ ...q, group, doubleSided: true });
  for (let j = -4; j < length + 4; j += tile) for (let i = -W; i < W; i += tile) add(quad(i, j, Math.min(W, i + tile), j + tile, 0, (Math.round(i / tile) + Math.round(j / tile)) % 2 ? col.ground2 : col.ground), 'room:floor');
  for (const side of [-1, 1]) {
    const x0 = side * HALF, x1 = side * (W + 0.5), lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    add(quad(lo, -4, hi, length + 4, 1, col.kerb), 'room:wall');
    add({ corners: [[x0, -4, 0], [x0, length + 4, 0], [x0, length + 4, 1], [x0, -4, 1]], fill: col.wall }, 'room:wall');
  }
  if (D.lanes.sleepers) for (const lane of LANES) for (let j = 0; j < length; j += 1.2) add(quad(lane - 0.8, j, lane + 0.8, j + 0.26, 0.008, col.sleeper), 'room:lanes');
  if (D.lanes.rails) for (const lane of LANES) for (const off of [-0.55, 0.55]) for (let j = -4; j < length + 4; j += 20) add(quad(lane + off - 0.05, j, lane + off + 0.05, Math.min(length + 4, j + 20), 0.016, col.rail), 'room:lanes');
  add(quad(-HALF, exit[1] - 0.4, HALF, exit[1] + 0.4, 0.02, col.exit), 'room:lanes');
  const colliders = [{ min: [-W - 0.5, -4, 0], max: [-HALF, length + 4, 4], hold: false }, { min: [HALF, -4, 0], max: [W + 0.5, length + 4, 4], hold: false }, { min: [-W, -4.5, 0], max: [W, -4, 4], hold: false }, { min: [-W, length + 4, 0], max: [W, length + 4.5, 4], hold: false }];
  // the line's pacing (game/roll.js pattern): see the header
  const ramp = Object.fromEntries(Object.entries(RAMP).filter(([f]) => prims.includes(f)));
  const roll = { pattern: [{ slots: lineSlots, kinds, forms, never: [['posts-left', 'posts-left'], ['posts-right', 'posts-right']].filter((q) => prims.includes(q[0])), ramp }] };
  // THE FRAME (course-view.js): where the reaction begins, the earliest a jump is pressed, and the follow camera that
  // puts the vanishing point on the screen's upper line and that place on its lower one
  const jumps = prims.filter((id) => PRIMITIVES[id].ask === 'jump'), reactAt = r2(pace.top * (jumps.length ? Math.max(...jumps.map((id) => pace.lead[id].early)) : pace.laneTime[1]));
  return { feel, rule, pace, prims, dress: D, bg: col.sky, reactAt, camera: courseCamera({ react: reactAt }), need: r2(need), rest, react, gap, sight: Math.ceil(pace.top * (need + react)), length, slots: list, blocks, roll, ways: rollWays(readRoll(roll, { blocks })), exit, start: [0, 0, 0], colliders, faces };
}

// the course as the runtime stands it: its lane, its rolled things (the same readers the scene uses), the hero
function worldOf(course, seed) {
  const N = live(), read = readRoll(course.roll, { blocks: course.blocks }), B = standBlocks(course.blocks, { rolled: rolledIds(read) });
  const w = N.createWorld({ entities: [heroOf(course.rule)], colliders: [...course.colliders, ...B.colliders], roll: { pattern: read.pattern, things: B.things } });
  const R = N.applyRoll(w, seed), stands = new Set(R.stand);
  // what stands in each slot, as the bot's eyes meet it
  const obs = course.slots.map((s) => { const bid = Object.keys(s.of).find((id) => stands.has(id)), P = PRIMITIVES[s.of[bid]]; return { k: s.k, id: s.of[bid], ask: P.ask, y0: s.y, y1: s.y + P.len, ...(P.ask === 'steer' ? { open: LANES[P.open] } : {}) }; });
  return { w, me: w.byId.hero, obs, rolled: R };
}

/** What a seed stands on a course, slot by slot, as a player meets it: [{ k, id, ask, y0, y1, open? }] (a bot's eyes,
 * here and in a page). */
export const courseObstacles = (course, seed = 1) => worldOf(course, seed).obs;

export function playCourse(course, { seed = 1, react = REACT, sight = course.sight, seconds = 120, trace = false } = {}) {
  const N = live(), { w, me, obs } = worldOf(course, seed), P = course.pace, rule = me.rule;
  const seen = {}, pressed = {}, hit = {}, line = [];
  let prev = 0, prevX = 0, press = 0, held = false, flown = false, heldFor = 0, wantX = 0, fast = false, still = 0, backing = 0, retries = 0, f = 0;
  for (; f < seconds * 60; f++) {
    const [x, y] = me.transform.pos, t = f * DT, v = (y - prev) / DT, vx = (x - prevX) / DT; prev = y; prevX = x;
    if (y > course.exit[1]) break;
    // (`trace`: where it went, every fifth frame: along, across, and whether it was in the air)
    if (trace && f % 5 === 0) line.push([Math.round(y * 100) / 100, Math.round(x * 100) / 100, me.grounded === false ? 1 : 0]);
    const inp = { forward: 1 };
    let next = null;
    for (const o of obs) {
      if (y > o.y1 + 0.4) continue;
      if (seen[o.k] === undefined && o.y0 - y <= sight) seen[o.k] = t;
      if (seen[o.k] === undefined || t < seen[o.k] + react) continue;
      if (!next) next = o;
    }
    if (next && next.ask === 'steer') wantX = next.open;
    if (!backing && next && next.ask === 'jump' && !pressed[next.k] && next.y0 - y <= P.lead[next.id].mid * Math.max(v, 3) && me.grounded !== false) { pressed[next.k] = true; press = 2; held = true; }
    // stopped against a thing: back off for a run-up, and come at it again
    if (backing > 0) { backing--; inp.forward = -1; if (!backing && next) pressed[next.k] = false; }
    else if (Math.abs(v) < 1 && f > 30) { if (++still > 25) { backing = 45; still = 0; retries++; } } else still = 0;
    if (press > 0) { inp.jump = 1; press--; }
    // (the jump held through its wind-up and its rise: let go only once it has left the ground and come back to it)
    if (held) { inp.jumpHeld = 1; heldFor++; if (me.grounded === false) flown = true; if ((flown && me.grounded) || heldFor > 90) { held = false; flown = false; heldFor = 0; } }
    const s = steer(rule, x, vx, wantX, P.steerSign);
    if (s) inp.strafe = s;
    N.stepWorld(w, inp, DT, hooks);
    // a hit: the speed broken (under half the top, having been running) at a thing
    if (v > 0.7 * P.top) fast = true;
    if (fast && v < 0.5 * P.top) { const o = obs.find((q) => y > q.y0 - 1.5 && y < q.y1 + 1); if (o) { hit[o.k] = true; fast = false; } }
  }
  const finished = me.transform.pos[1] > course.exit[1], hits = Object.keys(hit).map(Number);
  return { finished, seconds: Math.round(f * DT * 10) / 10, hits, clean: finished && !hits.length, retries, asks: obs.map((o) => o.id), ...(trace ? { line } : {}) };
}

export function courseAudit(course, { seeds = 12 } = {}) {
  const met = new Set(), unfair = [], unfinished = [], unpaced = [];
  let time = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const A = playCourse(course, { seed });
    met.add(A.asks.join(' '));
    const kinds = A.asks.map((a) => (PRIMITIVES[a].ask === 'jump' ? 'J' : 'S')).join('');
    if (rhythmFaults(kinds).length || A.asks.some((a, k) => k > 0 && PRIMITIVES[a].ask === 'steer' && a === A.asks[k - 1])) unpaced.push(seed);
    if (!A.clean) unfair.push(seed); else time += A.seconds;
    if (!playCourse(course, { seed, react: 0.8 }).finished) unfinished.push(seed);
  }
  const some = (list) => `seed ${list.slice(0, 6).join(', ')}${list.length > 6 ? ', …' : ''}`;
  const laws = [
    { law: 'fair', holds: !unfair.length, says: unfair.length ? `a player who reacts in ${course.react} s and sees ${course.sight} m hits something on ${unfair.length} of ${seeds} seeds (${some(unfair)})` : `a player who reacts in ${course.react} s and sees ${course.sight} m runs all ${seeds} seeds clean, in ${r2(time / seeds)} s a run` },
    { law: 'finishes', holds: !unfinished.length, says: unfinished.length ? `a slow player (0.8 s) does not finish ${unfinished.length} of ${seeds} seeds (${some(unfinished)})` : `a slow player (0.8 s) still finishes all ${seeds}` },
    { law: 'paced', holds: !unpaced.length, says: unpaced.length ? `${unpaced.length} of ${seeds} seeds run three of a kind, repeat a pair, or ask the same posts twice (${some(unpaced)})` : `no sampled course runs three asks of a kind, repeats a pair of kinds, or asks the same posts twice` },
    { law: 'apart', holds: met.size > 1, says: `${met.size} different courses in ${seeds} seeds, of ${course.ways} there are` },
  ];
  return { seeds, laws, ok: laws.every((l) => l.holds) };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A level's `obstacles`, read: true | { slots?: 4 … 40, rest?: 0.2 … 3 seconds }. */
export function readObstacles(v) {
  if (v === true) return { slots: 10, rest: REST };
  if (!isObj(v)) throw new Error('obstacles is true or { slots?, rest?, dress? } (an obstacle course run at speed: a lane of slots a seed fills, gameworld/roll-course.js)');
  for (const k of Object.keys(v)) if (k !== 'slots' && k !== 'rest' && k !== 'dress') throw new Error(`obstacles.${k} is not a course's setting (slots, rest, dress)`);
  if (v.dress !== undefined) dressOf(v.dress);   // (a theme there is, said by name)
  if (v.slots !== undefined && !(Number.isInteger(v.slots) && v.slots >= 4 && v.slots <= 40)) throw new Error('obstacles.slots is how many places the course has, 4 to 40');
  if (v.rest !== undefined && !(Number.isFinite(v.rest) && v.rest >= 0.2 && v.rest <= 3)) throw new Error('obstacles.rest is the seconds of rest after each ask is met, 0.2 to 3 (0.6 unsaid)');
  return { slots: v.slots ?? 10, rest: v.rest ?? REST, ...(v.dress !== undefined ? { dress: v.dress } : {}) };
}
/** A course level's stage: the lane as a world of its own, its things as `blocks`, its `roll` over them. */
export function obstacleStage(G, v) {
  const C = courseOf(G, readObstacles(v));
  return { kind: 'controllable', title: 'course', bg: C.bg, faces: C.faces, colliders: C.colliders, blocks: C.blocks, roll: structuredClone(C.roll),
    obstacles: { gap: C.gap, need: C.need, rest: C.rest, sight: C.sight, react: C.react, exit: C.exit, start: C.start, asks: C.prims, dress: C.dress.theme, reactAt: C.reactAt, camera: C.camera },
    worldFraming: { cameraPosition: [0, -8, 4], lookAt: [0, 12, 1], horizontalFov: 70 } };
}
/** A course stage's anchors: the start facing up the lane, the exit at its end, flat ground. */
export function obstacleEnds(manifest) {
  const c = manifest.obstacles, out = { spawn: c.start.slice(), heading: Math.PI / 2, exit: c.exit.slice(), exitHalf: EXIT_HALF.slice(), exitFrom: 'the end of the course', planar: true, beats: [], hazards: [] };
  for (const [k, val] of Object.entries({ ground: () => 0, rocks: null, colliders: manifest.colliders })) Object.defineProperty(out, k, { value: val, enumerable: false });
  return out;
}

/** A made level that is a course, read back as one (see the header); null for a level that is not. */
export function courseOfLevel(manifest) {
  const O = manifest?.obstacles, pilot = (manifest?.entities ?? []).find((e) => e?.pilotable) ?? manifest?.entities?.[0];
  if (!isObj(O) || !pilot?.rule || !Array.isArray(manifest.blocks) || !manifest.roll?.pattern?.[0]) return null;
  // (the pilot as the bot plays it: its own rule on its feet, steered in its own frame, never the camera's)
  const { move: _m, ...own } = pilot.rule, rule = { ...own, type: 'platform', eye: 0, collideRadius: own.collideRadius || 0.3, collideHeight: own.collideHeight || 1.7, step: own.step ?? 0.3 };
  const pace = paceOfRule(rule), byId = new Map(manifest.blocks.map((b) => [b.id, b]));
  const slots = manifest.roll.pattern[0].slots.map((ids, k) => {
    const of = Object.fromEntries(ids.map((id) => [id, id.replace(/^s\d+-/, '')])), first = byId.get(ids[0]);
    return { k, y: r2(first.at[1] - PRIMITIVES[of[ids[0]]].len / 2), of };
  });
  return { feel: null, rule, pace, prims: O.asks, need: O.need, rest: O.rest, react: O.react, gap: O.gap, sight: O.sight, length: O.exit[1] + 3, slots, blocks: manifest.blocks, roll: manifest.roll, ways: rollWays(readRoll(manifest.roll, { blocks: manifest.blocks })), exit: O.exit, start: O.start, colliders: manifest.colliders, faces: manifest.faces };
}
