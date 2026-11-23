/**
 * THE SORTIE PILOT — a cockpit level's mission (gameworld/flight-sortie.js) flown by a player on the runtime the page
 * runs, its bus judging it by the level's own mechanics: the machine gate of a sortie. As the stage pilot proves a rail
 * stage (stage-pilot.js), this proves a mission can be won with the craft it gives, beside the flight groups it gives.
 *
 * The player flies as a steady one does, reading only what the cockpit shows:
 *   its target     the nearest hostile (R) whenever it has none, or its target is down
 *   the lead pip   the nose brought onto where its bolts meet the target (the cockpit HUD's own pip, cockpit-hud.js
 *                  leadPoint), turned at the rates the craft has; the trigger pulled while the pip is on the nose and in
 *                  range
 *   the throttle   two thirds; back to a third close in with the target off the nose (the craft turns tightest
 *                  there), and the trigger pulled while the pip covers the target (as wide as it looks)
 *   a pass         too close to bring the nose round, it extends straight out at full throttle and turns back
 * The `still` player holds no input: a mission its flight groups win alone has no game in it for the player.
 *
 *   flySortie(manifest, { player?, seconds? }) → { won, result, reason, time, hull: { start, left }, downs, foes, player }
 *
 * Deterministic: the sim's fixed step, the world's seeded rules, the player a pure function of what it sees.
 */
import { simLevel } from '../game/level-sim.js';
import { synthesizeLevel, mergeEventManifests } from '../game/level-synth.js';
import { outcomeIn } from '../game/level-equivalence.js';
import { leadPoint } from '../scene/channels/cockpit-hud.js';

export const SORTIE_PLAYERS = Object.freeze(['pilot', 'still']);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const r1 = (v) => Math.round(v * 10) / 10;
// the pip on the nose within this (rad) pulls the trigger; the nose turned at this gain on its error
const ON = 0.05, GAIN = 4;
// nearer than this (m) and off the nose, the throttle back to a third
const CLOSE = 400;
// nearer than the first (m) and well off the nose, it extends straight out, and turns back past the second
const EXTEND = [150, 700];

export function flySortie(manifest, { player = 'pilot', seconds = 300 } = {}) {
  if (!SORTIE_PLAYERS.includes(player)) throw new Error(`sortie pilot: player is ${SORTIE_PLAYERS.join(' or ')}`);
  const P0 = (manifest.entities ?? []).find((e) => e.pilotable);
  if (!P0 || P0.rule?.type !== 'starfighter') return { won: false, result: null, reason: 'no starfighter to fly', time: 0, hull: null, downs: 0, foes: 0, player };
  let payload = manifest;
  if (payload.game && !payload.game.on && Array.isArray(payload.game.mechanics)) {
    const S = synthesizeLevel(payload);
    payload = { ...payload, game: S.game, events: mergeEventManifests(payload.events ?? null, S.mechEvents) ?? {} };
  }
  const sim = simLevel({ entities: structuredClone(payload.entities || []), events: payload.events || {}, world: payload }, { ground: () => null });
  const W = sim.world, p = W.byId[W.pilotId];
  if (!p) return { won: false, result: null, reason: 'the level has no pilot', time: 0, hull: null, downs: 0, foes: 0, player };
  const hull0 = p.body.hp, foes = W.entities.filter((e) => e.team && e.team !== p.team && e.body);
  let result = null, seen = 0, t = 0, k = 0, thr = null, extend = false;
  while (t < seconds) {
    const inp = sim.input;
    for (const key of Object.keys(inp)) delete inp[key];
    if (player === 'pilot' && !p.downed) {
      const T = p.target ? W.byId[p.target] : null;
      if (k === 0) { inp.thr = 'twothirds'; thr = 'twothirds'; }
      if (!T || T.downed || T.gone || T.dormant) { if (k % 10 === 0) inp.tgt = 'near'; }
      else if (p.sfF) {
        const w = p.weapon, q = p.transform.pos, at = w && w.projectileSpeed ? leadPoint(q, T.transform.pos, T.vel || [0, 0, 0], w.projectileSpeed) ?? T.transform.pos : T.transform.pos;
        const d = [at[0] - q[0], at[1] - q[1], at[2] - q[2]], f = p.sfF, u = p.sfU, y = [u[1] * f[2] - u[2] * f[1], u[2] * f[0] - u[0] * f[2], u[0] * f[1] - u[1] * f[0]];
        const ax = d[0] * f[0] + d[1] * f[1] + d[2] * f[2], ay = -(d[0] * y[0] + d[1] * y[1] + d[2] * y[2]), az = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
        const e1 = Math.atan2(ay, ax), e2 = Math.atan2(az, ax), L = Math.hypot(d[0], d[1], d[2]);
        // (too close to bring the nose round: extend straight out at full throttle, and turn back for a pass)
        if (!extend && L < EXTEND[0] && (Math.abs(e1) > 0.3 || Math.abs(e2) > 0.3)) extend = true;
        else if (extend && L > EXTEND[1]) extend = false;
        if (!extend) { inp.yaw = clamp(e1 * GAIN, -1, 1); inp.pitch = clamp(e2 * GAIN, -1, 1); }
        // (the trigger while the pip covers the target, as wide as the target looks; close in and off the nose, the
        // throttle back to a third, where the craft turns tightest, and up to two thirds again once it is lined up)
        const on = Math.max(ON, Math.atan2(((T.body && T.body.radius) || 5) * 1.2, L));
        if (Math.abs(e1) < on && Math.abs(e2) < on && L <= (w ? w.range : 1500)) inp.fire = 1;
        const want = extend ? 'full' : L < CLOSE && (Math.abs(e1) > 0.25 || Math.abs(e2) > 0.25) ? 'third' : 'twothirds';
        if (want !== thr) { inp.thr = want; thr = want; }
      }
    }
    sim.frame(1 / 30);
    t += 1 / 30; k++;
    result = outcomeIn(payload.game, sim.bus.log, seen);
    seen = sim.bus.log.length;
    if (result) break;
  }
  const downs = foes.filter((e) => e.downed || (e.body && e.body.hp <= 0)).length;
  const reason = result === 'success' ? null
    : result === 'fail' ? (p.downed || p.body.hp <= 0 ? `shot down at ${r1(t)} s, ${downs} of ${foes.length} hostiles down` : `the mission failed at ${r1(t)} s (a craft it was to protect is down)`)
    : `ran out of time, ${downs} of ${foes.length} hostiles down`;
  return { won: result === 'success', result, reason, time: r1(t), hull: { start: hull0, left: r1(Math.max(0, p.body.hp)) }, downs, foes: foes.length, player };
}
