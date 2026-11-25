/**
 * THE STAGE PILOT — a rail stage (rail-stage.js, flown on the rail rule: worlds/controllable/rules-rail.js) flown by a
 * player on the runtime the page runs, its bus judging it by the level's own mechanics: the machine gate of a stage.
 * Where the lesson pilot proves a lesson can be passed (lesson-pilot.js), this proves a stage can be won: its hazards
 * passed, its waves met and its boss shot down, with the shield it was given.
 *
 * The player flies as an attentive one does, reading only what the page shows:
 *   the way ahead   each hazard within a few seconds of the way (the level's hazard zones) taken wide, on the side of the
 *                   way it does not stand on, before it is reached
 *   its foes        the nearest fighter awake in the guns' range (the boss's parts, at the way's end) brought onto them: the
 *                   craft steered to its place about the way; the trigger held while one is in the gun's range
 *   their rounds    a round that would pass within the craft's reach in the next half second rolled through (the
 *                   rail's roll: Q / E, unhurt while it turns), away from the way's middle
 * The `still` player holds no input: a stage that one wins has no game in it.
 *
 * The level is stepped as the page steps it (game/level-sim.js): its world, its bus, its zones and the cast's facts (the
 * hits on the craft, the foes downed), the ground under the craft the airspace's own.
 *
 *   flyStage(manifest, { player?, seconds? }) → { won, result: 'success' | 'fail' | null, reason, time, hp: { start, left },
 *                                               foes, downs, boss: { parts, down }, player }
 *
 * Deterministic: the sim's fixed step, the world's seeded rules, the player a pure function of what it sees.
 */
import { simLevel } from '../game/level-sim.js';
import { synthesizeLevel, mergeEventManifests } from '../game/level-synth.js';
import { outcomeIn } from '../game/level-equivalence.js';
import { railPathFrame } from './rail-stage.js';
import { airspaceOf } from './airspace.js';

export const STAGE_PLAYERS = Object.freeze(['pilot', 'still']);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const r1 = (v) => Math.round(v * 10) / 10;
// how far ahead a hazard is read (s at the stage's speed), and the room it is given past its edge (m)
const LOOK_S = 3, WIDE = 14;
// a round read this many seconds before it would pass, and the miss (m past its own radius) that is rolled through
const DODGE_S = 0.5, REACH = 8;
const awake = (e) => !!(e && e.team === 'foes' && e.body && e.body.hittable !== false && !e.downed && !e.gone && !e.dormant && e.deadAt == null);

/** Where a point lies about the way at `s` along it, seen down its heading there: metres right of it and up from it. */
function aboutWay(path, s, q) {
  const F = railPathFrame(path, s), hl = Math.hypot(F.t[0], F.t[1]) || 1, rx = F.t[1] / hl, ry = -F.t[0] / hl;
  const d = [q[0] - F.p[0], q[1] - F.p[1], q[2] - F.p[2]], a = d[0] * F.t[0] + d[1] * F.t[1] + d[2] * F.t[2];
  return [d[0] * rx + d[1] * ry, d[2] - a * F.t[2]];
}
/** A point's distance along the way, near a guess (the frame's own leg searched about it). */
function alongOf(path, q, near, span) {
  let best = near, bd = Infinity;
  for (let s = Math.max(0, near - span); s <= near + span; s += 5) {
    const F = railPathFrame(path, s), d = (q[0] - F.p[0]) ** 2 + (q[1] - F.p[1]) ** 2 + (q[2] - F.p[2]) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function flyStage(manifest, { player = 'pilot', seconds = 400 } = {}) {
  if (!STAGE_PLAYERS.includes(player)) throw new Error(`stage pilot: player is ${STAGE_PLAYERS.join(' or ')}`);
  const fail0 = (reason) => ({ won: false, result: null, reason, time: 0, hp: null, foes: 0, downs: 0, boss: null, player });
  const P0 = (manifest.entities ?? []).find((e) => e.pilotable);
  if (!P0 || P0.rule?.type !== 'rail') return fail0('no craft on a rail to fly');
  let payload = manifest;
  if (payload.game && !payload.game.on && Array.isArray(payload.game.mechanics)) {
    const S = synthesizeLevel(payload);
    payload = { ...payload, game: S.game, events: mergeEventManifests(payload.events ?? null, S.mechEvents) ?? {} };
  }
  const { field } = airspaceOf(manifest), top = field.topAt ?? field.groundAt ?? null;
  const sim = simLevel({ entities: structuredClone(payload.entities || []), events: payload.events || {}, world: payload }, { ground: top ? (q) => top(q[0], q[1]) : () => null });
  const W = sim.world, p = W.byId[W.pilotId];
  if (!p) return fail0('the level has no pilot');
  const rule = p.rule, path = rule.path, box = rule.box || { hx: 30, hz: 18 }, speed = rule.speed || 60;
  // the hazards the level hurts with (its hazard-damage zones): each a centre and its reach across and up
  const hazards = (manifest.game?.mechanics ?? []).filter((m) => m.kind === 'hazard-damage').flatMap((m) => m.hazards ?? [])
    .map((h) => ({ at: h.at, rx: h.half ? h.half[0] : h.radius, rz: h.half ? h.half[2] : h.radius }));
  const L = railLength(path);
  for (const h of hazards) h.s = alongOf(path, h.at, L / 2, L / 2);
  const hp0 = Number(sim.bus.vars.hp) || null;
  const foes = W.entities.filter((e) => e.team === 'foes' && e.body && Number.isFinite(e.body.hp));
  const bossParts = foes.filter((e) => /^boss-/.test(e.id));
  let result = null, seen = 0, t = 0;
  while (t < seconds) {
    const inp = sim.input;
    for (const k of Object.keys(inp)) delete inp[k];
    if (player === 'pilot') {
      const s = p.along || 0, off = p.off || [0, 0];
      // the foe to bring onto the guns: the nearest awake one ahead (the boss's parts at the way's end)
      let aim = null, ad = Infinity;
      const range = p.weapon?.range ?? 600;
      for (const e of foes) {
        if (!awake(e)) continue;
        const q = e.transform.pos, d = Math.hypot(q[0] - p.transform.pos[0], q[1] - p.transform.pos[1], q[2] - p.transform.pos[2]);
        if (d <= range && d < ad) { ad = d; aim = e; }
      }
      let want = [0, 0];
      if (aim) { const a = aboutWay(path, s, aim.transform.pos); want = [clamp(a[0], -box.hx, box.hx), clamp(a[1], -box.hz, box.hz)]; }
      // a hazard ahead in the way's box, read before it is reached: taken wide on its open side, whatever the aim
      for (const h of hazards) {
        const ds = h.s - s;
        if (ds < -5 || ds > speed * LOOK_S) continue;
        const a = aboutWay(path, h.s, h.at), clearX = h.rx + WIDE;
        if (Math.abs(want[0] - a[0]) < clearX && Math.abs(want[1] - a[1]) < h.rz + WIDE) {
          const side = a[0] > 0 ? -1 : a[0] < 0 ? 1 : (off[0] >= 0 ? 1 : -1);
          want = [clamp(a[0] + side * clearX, -box.hx, box.hx), want[1]];
          // (a hazard filling its side of the box: over it, or under it, where there is room)
          if (Math.abs(want[0] - a[0]) < clearX) want[1] = clamp(a[1] + (a[1] <= 0 ? 1 : -1) * (h.rz + WIDE), -box.hz, box.hz);
        }
      }
      inp.turn = clamp((want[0] - off[0]) / 8, -1, 1);
      inp.lift = clamp((want[1] - off[1]) / 8, -1, 1);
      if (aim) inp.fire = 1;
      // a round coming that would pass within the craft's reach in the next moments: rolled through, away from it
      if (!p.rolling) {
        const F = railPathFrame(path, s), v = p.airspeed || speed, q = p.transform.pos;
        for (const r of W.projectiles || []) {
          if (r.owner === p.id) continue;
          const rv = [r.vel[0] - F.t[0] * v, r.vel[1] - F.t[1] * v, r.vel[2] - F.t[2] * v], d = [r.pos[0] - q[0], r.pos[1] - q[1], r.pos[2] - q[2]];
          const vv = rv[0] ** 2 + rv[1] ** 2 + rv[2] ** 2 || 1, tc = -(d[0] * rv[0] + d[1] * rv[1] + d[2] * rv[2]) / vv;
          if (tc < 0 || tc > DODGE_S) continue;
          const miss = Math.hypot(d[0] + rv[0] * tc, d[1] + rv[1] * tc, d[2] + rv[2] * tc);
          if (miss < (r.projRadius || 0.5) + REACH) { inp.strafe = off[0] > 0 ? -1 : 1; break; }
        }
      }
    }
    sim.frame(1 / 30);
    t += 1 / 30;
    result = outcomeIn(payload.game, sim.bus.log, seen);
    seen = sim.bus.log.length;
    if (result) break;
  }
  const downs = foes.filter((e) => e.downed || e.deadAt != null || (e.body && e.body.hp <= 0)).length;
  const bossDown = bossParts.filter((e) => e.downed || e.deadAt != null || (e.body && e.body.hp <= 0)).length;
  const left = Number(sim.bus.vars.hp);
  const reason = result === 'success' ? null
    : result === 'fail' ? `shot down ${r1(p.along || 0)} m along the way (${Math.round((100 * (p.along || 0)) / L)}%), ${downs} of ${foes.length} foes down`
    : `ran out of time ${r1(p.along || 0)} m along the way, the boss ${bossDown} of ${bossParts.length} parts down`;
  return { won: result === 'success', result, reason, time: r1(t), hp: { start: hp0, left: Number.isFinite(left) ? left : null }, foes: foes.length, downs, boss: { parts: bossParts.length, down: bossDown }, player };
}

function railLength(P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return L || 1; }
