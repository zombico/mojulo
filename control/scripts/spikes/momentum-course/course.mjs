// SPIKE momentum-course: obstacle-course primitives for a momentum hero seen from behind, laid by RHYTHM (seconds
// between asks, turned into metres by the hero's speed), and a REACTION BOT that plays them: it sees only so far ahead,
// and acts only a reaction time after it first sees a thing. Not product code.
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { createWorld, stepWorld } = await import('../../../lib/graph/worlds/controllable-world.js');
const { feelRule } = await import('../../../lib/graph/gameworld/feel/lower.js');

export const DT = 1 / 60;
// THE LANE: three lanes 2 m apart, walled either side; the hero runs up +y
export const LANES = [-2, 0, 2], HALF = 3.3;
// THE PRIMITIVES (camera behind the hero: it judges sideways well and a gap's length badly, so the asks are a jump
// over a thing whose height is read, and a lane to be in). Each a row: what it asks, and the boxes it stands
//   hurdle  a low bar across the whole lane: jump (a wide window)
//   block   a longer, higher box across it: jump (a tighter window)
//   posts   pillars in two of the three lanes, too tall to jump: be in the open lane
export const PRIMITIVES = Object.freeze({
  hurdle: { ask: 'jump', len: 0.7, h: 0.75 },
  block: { ask: 'jump', len: 1.4, h: 1.0 },
  posts: { ask: 'steer', len: 0.6, h: 3 },
});
const dice = (seed) => { let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0; return (n) => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) % n; }; };

export function heroRule(feel) { return { type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...feelRule(feel) }; }
const spawn = (rule, colliders, y = 0) => { const w = createWorld({ entities: [{ id: 'h', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [0, y, 0], heading: Math.PI / 2 } }], colliders }); return { w, me: w.byId.h }; };
const hooks = { ground: () => 0 };
const walls = (len) => [{ min: [-HALF - 1, -5, 0], max: [-HALF, len, 6] }, { min: [HALF, -5, 0], max: [HALF + 1, len, 6] }];

/** What the hero is, measured once: its top speed, which way the stick steers, and for each jump primitive the lead
 * (seconds before it) at which a jump clears it: the window's two ends and its middle, at top speed. */
export function calibrate(feel) {
  const rule = heroRule(feel);
  const a = spawn(rule, []); let prev = 0, top = 0;
  for (let f = 0; f < 600; f++) { stepWorld(a.w, { forward: 1 }, DT, hooks); top = Math.max(top, (a.me.transform.pos[1] - prev) / DT); prev = a.me.transform.pos[1]; }
  const x0 = a.me.transform.pos[0];
  for (let f = 0; f < 20; f++) stepWorld(a.w, { forward: 1, strafe: 1 }, DT, hooks);
  const steerSign = Math.sign(a.me.transform.pos[0] - x0) || 1;
  const lead = {};
  for (const [id, P] of Object.entries(PRIMITIVES)) {
    if (P.ask !== 'jump') continue;
    const ok = [];
    for (let d = 0.2; d <= 12; d += 0.1) {
      const { w, me } = spawn(rule, [{ min: [-HALF, 60, 0], max: [HALF, 60 + P.len, P.h] }]);
      let pressed = 0, over = false;
      for (let f = 0; f < 60 * 9 && !over; f++) {
        const inp = { forward: 1 };
        if (!pressed && 60 - me.transform.pos[1] <= d) pressed = 1;
        if (pressed && pressed <= 2) { inp.jump = 1; pressed++; }
        if (pressed) inp.jumpHeld = 1;
        stepWorld(w, inp, DT, hooks);
        over = me.transform.pos[1] > 60 + P.len + 2;
      }
      if (over) ok.push(d);
    }
    lead[id] = ok.length ? { late: ok[0] / top, early: ok[ok.length - 1] / top, mid: (ok[0] + ok[ok.length - 1]) / 2 / top, frames: Math.round(((ok[ok.length - 1] - ok[0]) / top) * 60) } : null;
  }
  // a lane change at top speed, steered as a player learns to (push, then push back): seconds to be inside the open lane
  const laneTime = [0, 2, 4].map((d) => {
    if (!d) return 0;
    const { w, me } = spawn(rule, []);
    for (let f = 0; f < 400; f++) stepWorld(w, { forward: 1 }, DT, hooks);
    let px = me.transform.pos[0];
    for (let f = 0; f < 600; f++) {
      const x = me.transform.pos[0], vx = (x - px) / DT; px = x;
      if (Math.abs(x - d) < 0.5) return f * DT;
      const slide = (vx * Math.abs(vx)) / (2 * (rule.accel || 7)), e = d - (x + slide), inp = { forward: 1 };
      if (Math.abs(e) > 0.12) inp.strafe = Math.sign(e) * steerSign;
      stepWorld(w, inp, DT, hooks);
    }
    return Infinity;
  });
  return { feel, rule, top, steerSign, lead, laneTime };
}
/** What an ask NEEDS, in seconds before it: a jump its earliest lead; a set of posts the lane change it asks for. */
export const needOf = (cal, o) => (o.ask === 'jump' ? cal.lead[o.id].early : cal.laneTime[o.move]);

/** A course: `asks` primitives, one every `rhythm` seconds at the hero's top speed, after a run-up; which, and which
 * lane a set of posts leaves open, by the seed. `mix`: the primitives it draws from. */
export function layCourse(cal, { seed = 1, rhythm = 1, asks = 12, mix = ['hurdle', 'block', 'posts'], runup = 24, fair = false } = {}) {
  const below = dice(seed), obs = [];
  let y = runup, lane = 1;
  for (let k = 0; k < asks; k++) {
    const id = mix[below(mix.length)], P = PRIMITIVES[id];
    if (P.ask === 'steer') {
      // (the open lane is never the one the last posts left open: a set of posts always asks for a move)
      let open = below(LANES.length); if (open === lane) open = (open + 1) % LANES.length;
      const move = Math.abs(open - lane);
      lane = open;
      // (`fair`: `rhythm` is the REST between asks, and each ask is given the time it needs on top of it)
      if (fair) y += cal.top * cal.laneTime[move];
      obs.push({ k, id, ask: 'steer', move, y0: y, y1: y + P.len, open: LANES[open], boxes: LANES.filter((_, i) => i !== open).map((x) => ({ min: [x - 1, y, 0], max: [x + 1, y + P.len, P.h] })) });
    } else { if (fair) y += cal.top * cal.lead[id].early; obs.push({ k, id, ask: 'jump', y0: y, y1: y + P.len, boxes: [{ min: [-HALF, y, 0], max: [HALF, y + P.len, P.h] }] }); }
    y += cal.top * rhythm;
  }
  const length = y + 10;
  // the sight the course asks for: its neediest ask, in metres at top speed (before any reaction)
  const needs = Math.max(...obs.map((o) => needOf(cal, o)));
  return { seed, rhythm, obs, length, needs, colliders: [...walls(length + 10), ...obs.flatMap((o) => o.boxes)] };
}

/**
 * THE REACTION BOT. It knows how to play (the right ask for each primitive, the lead a jump wants); what it lacks is
 * what a player lacks: it SEES a thing only inside `sight` metres ahead, and ACTS on it only `react` seconds after it
 * first saw it. Late, it acts at once. Stopped by a thing, it does what a player does: hops, and steps for the lane.
 *   → { finished, seconds, hits: [k], clean, stuck: k | null, slowest }
 */
export function playCourse(cal, course, { react = 0.4, sight = 30, seconds = 90 } = {}) {
  const { w, me } = spawn(cal.rule, course.colliders);
  const seen = {}, pressed = {}, hit = {};
  let prev = 0, prevX = 0, press = 0, held = false, wantX = 0, slowest = Infinity, fast = false, still = 0, backing = 0, retries = 0, f = 0;
  for (; f < seconds * 60; f++) {
    const [x, y] = me.transform.pos, t = f * DT, v = (y - prev) / DT, vx = (x - prevX) / DT; prev = y; prevX = x;
    if (y > course.length) break;
    const inp = { forward: 1 };
    let next = null;
    for (const o of course.obs) {
      if (y > o.y1 + 0.4) continue;                                   // behind it
      if (seen[o.k] === undefined && o.y0 - y <= sight) seen[o.k] = t;
      if (seen[o.k] === undefined || t < seen[o.k] + react) continue;  // not seen yet, or not yet acted on
      if (!next) next = o;
    }
    if (next && next.ask === 'steer') wantX = next.open;
    if (!backing && next && next.ask === 'jump' && !pressed[next.k] && next.y0 - y <= cal.lead[next.id].mid * Math.max(v, 3) && me.grounded !== false) { pressed[next.k] = true; press = 2; held = true; }
    // stopped against a thing it must jump: what a player does, back off for a run-up and come at it again
    if (backing > 0) { backing--; inp.forward = -1; if (!backing && next) pressed[next.k] = false; }
    else if (Math.abs(v) < 1 && f > 30) { if (++still > 25) { backing = 45; still = 0; retries++; } } else still = 0;
    if (press > 0) { inp.jump = 1; press--; }
    if (held) { inp.jumpHeld = 1; if (me.grounded && press <= 0 && f > 2) held = false; }
    // steering has momentum too (the sideways speed builds and keeps): push toward the lane, then push back in time
    // to stop on it, as a player learns to (the way it would still slide, at the rule's own push)
    const slide = (vx * Math.abs(vx)) / (2 * (cal.rule.accel || 7)), e = wantX - (x + slide);
    if (Math.abs(e) > 0.12) inp.strafe = Math.sign(e) * cal.steerSign;
    stepWorld(w, inp, DT, hooks);
    // a hit: the speed broken (under half the top, having been running) at a thing
    if (v > 0.7 * cal.top) fast = true;
    if (fast && v < 0.5 * cal.top) { const o = course.obs.find((q) => y > q.y0 - 1.5 && y < q.y1 + 1); if (o) { hit[o.k] = true; fast = false; } }
    if (y > 20) slowest = Math.min(slowest, v);
  }
  const finished = me.transform.pos[1] > course.length, hits = Object.keys(hit).map(Number);
  const at = me.transform.pos[1], stuck = finished ? null : (course.obs.find((o) => o.y1 > at - 0.5) || { k: -1 }).k;
  return { finished, seconds: Math.round(f * DT * 10) / 10, hits, clean: finished && !hits.length, stuck, retries, slowest: Math.round(slowest * 10) / 10 };
}

/** Many seeds of one design played by one player: how many ran clean, finished, stuck. */
export function trial(cal, design, player, seeds = 12) {
  let clean = 0, finished = 0, hits = 0, time = 0, needs = 0;
  for (let seed = 1; seed <= seeds; seed++) { const C = layCourse(cal, { ...design, seed }), R = playCourse(cal, C, player); needs = Math.max(needs, C.needs); clean += R.clean ? 1 : 0; finished += R.finished ? 1 : 0; hits += R.hits.length; if (R.finished) time += R.seconds; }
  return { seeds, clean, finished, hits, needs, seconds: finished ? Math.round((time / finished) * 10) / 10 : null };
}
