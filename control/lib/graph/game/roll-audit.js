/**
 * THE SEEDS AUDIT — a level with a roll (game/roll.js) is many maps, so one walk proves one of them. This walks a SAMPLE
 * of its seeds in Node, with no browser: every sampled seed is rolled as the page rolls it (the same whole-number dice)
 * and held to the laws below, and a few are played through to the level's own end. A machine gate: it measures and
 * says, it never refuses, and it says how many seeds it walked. The eyes gate (does a roll read as designed) is not here.
 *
 *   ROLL_LAWS, each { law, holds, says }:
 *     body          the pilot has a body (a collide radius): without one no cover stops it, and a roll changes nothing
 *     way-through   on every sampled seed the walk's way is open: from the start through the contract's own walk
 *                   (its audits' via points and targets, in order), and from the start to every pickup
 *     apart         the sample is not one map: how many different rolls it met, of how many there are
 *     won           the seeds played through reach the level's success, led corner to corner on the nav grid
 *
 *   rollAudit(payload, { seeds?, plays?, seconds? }) → { seeds, ways, distinct, laws, failed: [{ seed, law, says }],
 *                                                        played: [{ seed, outcome, seconds }], ok }
 *     seeds     how many to walk, from 1 (24): seed 1 is the reference roll
 *     plays     how many of them to play through, spread over the sample, seed 1 first (3)
 *   navWin(payload, { seed?, seconds? })   → { outcome, seconds, hops }   one seed played: the pilot led through the
 *                                            contract's walk, each leg by the nav grid's next corner
 *   referenceRoute(payload)                → [[x, y], …] | null   the reference roll's walk, corner by corner, for a
 *                                            walk that goes in straight legs (the browser's traversal): null when a leg
 *                                            has no way
 *
 * THE GRID IT IS LED BY: the nav grid is cut for one floor at a body's own height, so on land that climbs it reads a
 * wall further up the slope as walked under. A rolled thing stands on the ground wherever it is, so here every standing
 * one blocks at any height.
 *
 * Deterministic: no dice of its own, the level's seeded rules, a fixed step.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { levelSim, steer, outcomeIn, keyEvents, auditPath, SIM_DT } from './level-equivalence.js';
import { rollOf } from './level-sim.js';
import { rollWays } from './roll.js';

export const ROLL_LAWS = Object.freeze(['body', 'way-through', 'apart', 'won']);

let E = null;
const live = () => (E ??= composeLive());
const pilotOf = (payload) => { const es = payload.entities || []; return es.find((e) => e && e.pilotable) || es.find((e) => e && e.rule && (e.rule.type === 'walk' || e.rule.type === 'platform')) || es[0] || null; };
// (`berth`: a walk LED by the grid is given room at a corner: the grid's cells are coarser than the body, and a body
// steered at the next corner the moment its cell clears the last one catches its shoulder on the wall's end)
const BERTH = 0.5;
const bodyOf = (p, z, berth = 0) => ({ radius: ((p.rule && p.rule.collideRadius) || 0.3) + berth, height: (p.rule && p.rule.collideHeight) || 1.7, footZ: z });
const feet = (e) => e.transform.pos[2] - ((e.rule && e.rule.eye) || 0);
// the world the walk is led on: its colliders, every standing rolled thing blocking at any height (kept, so its grid is)
const led = (world) => ({ colliders: (world.colliders || []).map((c) => (c.roll != null ? { min: [c.min[0], c.min[1], -1e6], max: [c.max[0], c.max[1], 1e6] } : c)) });
// where the level's walk goes: the contract's own (its audits), and what lies to be picked up
function walkOf(payload) {
  const { points } = auditPath(payload.game || {});
  const pickups = ((payload.game && payload.game.mechanics) || []).filter((m) => m && m.kind === 'collect').flatMap((m) => (m.pickups || []).map((p) => p.at)).filter(Array.isArray);
  return { points, pickups };
}
const r1 = (v) => Math.round(v * 10) / 10;
const at2 = (p) => `[${r1(p[0])}, ${r1(p[1])}]`;

// one seed's world with no ground and no bus: the roll applied, its laws' walk asked of the nav grid
function waysOf(payload, seed) {
  const N = live(), W = N.createWorld({ entities: payload.entities || [], ...(payload.colliders ? { colliders: payload.colliders } : {}), roll: payload.roll });
  const R = N.applyRoll(W, seed), L = led(W), p = pilotOf(payload), { points, pickups } = walkOf(payload);
  if (!p) return { roll: R, shut: [] };
  const from = [p.transform.pos[0], p.transform.pos[1]], body = bodyOf(p, feet(p)), shut = [];
  let a = from;
  for (const b of points) { if (N.navPath(L, a, [b[0], b[1]], body) === null) shut.push(`no way from ${at2(a)} to ${at2(b)}`); a = [b[0], b[1]]; }
  for (const b of pickups) if (N.navPath(L, from, [b[0], b[1]], body) === null) shut.push(`no way to the pickup at ${at2(b)}`);
  return { roll: R, shut };
}

export function navWin(payload, { seed = 1, seconds = 120 } = {}) {
  const N = live(), sim = levelSim(payload, { seed }), me = sim.world.byId[sim.world.pilotId], L = led(sim.world), { points } = walkOf(payload);
  let outcome = null, next = 0, best = Infinity, still = 0, hop = 0, hops = 0, i = 0;
  const n = Math.round(seconds / SIM_DT);
  for (; i < n && !outcome && me && points.length; i++) {
    const t = me.transform.pos, goal = points[Math.min(next, points.length - 1)], d = Math.hypot(goal[0] - t[0], goal[1] - t[1]);
    let inp = {};
    if (d < 1.2 && next < points.length - 1) { next++; best = Infinity; still = 0; }
    else {
      const path = N.navPath(L, [t[0], t[1]], [goal[0], goal[1]], bodyOf(me, feet(me), BERTH)) || N.navPath(L, [t[0], t[1]], [goal[0], goal[1]], bodyOf(me, feet(me)));
      inp = steer(me, path && path.length ? [path[0][0], path[0][1], t[2]] : goal);
      // no progress for a second: a hop over what stands in the way (as winScript's)
      if (d < best - 0.05) { best = d; still = 0; } else if (++still > 30) { hop = 6; still = 0; hops++; }
      if (hop > 0) { inp.jump = 1; inp.jumpHeld = 1; hop--; }
    }
    for (const k of Object.keys(sim.input)) delete sim.input[k];
    Object.assign(sim.input, inp);
    const n0 = sim.bus.log.length;
    sim.frame(SIM_DT, keyEvents(payload, inp.keys));
    outcome = outcomeIn(payload.game || {}, sim.bus.log, n0);
  }
  return { outcome, seconds: r1(i * SIM_DT), hops };
}

export function referenceRoute(payload) {
  if (!payload || !payload.roll) return null;
  const N = live(), W = N.createWorld({ entities: payload.entities || [], ...(payload.colliders ? { colliders: payload.colliders } : {}), roll: payload.roll });
  N.applyRoll(W, 1);
  const L = led(W), p = pilotOf(payload), { points } = walkOf(payload);
  if (!p || !points.length) return null;
  const body = bodyOf(p, feet(p), BERTH), out = [];
  let a = [p.transform.pos[0], p.transform.pos[1]];
  for (const b of points) {
    const path = N.navPath(L, a, [b[0], b[1]], body);
    if (path === null) return null;
    for (const c of path) out.push([c[0], c[1]]);
    if (!path.length) out.push([b[0], b[1]]);   // (a clear line: navPath says [], the leg is the point itself)
    a = [b[0], b[1]];
  }
  return out;
}

export function rollAudit(payload, { seeds = 24, plays = 3, seconds = 120 } = {}) {
  if (!payload || !payload.roll) throw new Error('rollAudit: the level has no roll');
  const p = pilotOf(payload), ways = rollWays(payload.roll), failed = [], met = new Set();
  const hasBody = !!(p && p.rule && p.rule.collideRadius > 0);
  for (let seed = 1; seed <= seeds; seed++) {
    const w = waysOf(payload, seed);
    met.add(w.roll.stand.join('+'));
    for (const says of w.shut) failed.push({ seed, law: 'way-through', says });
  }
  // the seeds played: the first, then spread over the sample
  const picks = [...new Set(Array.from({ length: Math.min(plays, seeds) }, (_, k) => 1 + Math.floor((k * seeds) / Math.max(1, plays))))];
  const played = picks.map((seed) => { const w = navWin(payload, { seed, seconds }); if (w.outcome !== 'success') failed.push({ seed, law: 'won', says: `played ${w.seconds} s and ended ${w.outcome || 'nowhere'}` }); return { seed, outcome: w.outcome, seconds: w.seconds }; });
  const shut = new Set(failed.filter((f) => f.law === 'way-through').map((f) => f.seed)), lost = failed.filter((f) => f.law === 'won').map((f) => f.seed);
  const apart = met.size > 1 || ways <= 1;
  const laws = [
    { law: 'body', holds: hasBody, says: hasBody ? 'the pilot has a body: cover stops it' : 'the pilot has no collide radius (rule.collideRadius): no cover stops it, so every roll plays alike' },
    { law: 'way-through', holds: shut.size === 0, says: shut.size ? `${shut.size} of ${seeds} seeds shut the way (seed ${[...shut].slice(0, 6).join(', ')}${shut.size > 6 ? ', …' : ''})` : `the way is open on all ${seeds} seeds walked` },
    { law: 'apart', holds: apart, says: `${met.size} different roll${met.size === 1 ? '' : 's'} in ${seeds} seeds, of ${ways} there ${ways === 1 ? 'is' : 'are'}` },
    { law: 'won', holds: lost.length === 0, says: lost.length ? `seed ${lost.join(', ')} of the ${played.length} played did not reach the level's success` : `${played.length} seed${played.length === 1 ? '' : 's'} played through to success (seed ${played.map((q) => q.seed).join(', ')})` },
  ];
  return { seeds, ways, distinct: met.size, laws, failed, played, ok: laws.every((l) => l.holds) };
}
