/**
 * THE PLAYTHROUGH — a made level played by a scripted player on the runtime it ships (game/level-sim.js: the level's
 * world and its bus stepped together headless, in the page's order, on the page's ground and colliders), so whether a
 * level can be won is measured, not assumed. The machine gate behind "a made game is one a player can win"; nobody has
 * looked: the eyes gate stays the operator's.
 *
 * THE PLAYERS (input only, never outcome: what a person at the keys and the mouse could do, read from what they see):
 *   basic   locks on to the foe it fights (the level's lock, when it has one), closes on it and plays the light string
 *           (presses at a person's pace, the moveset's buffer taking them), raises the guard between strings, and turns
 *           the sidearm on a foe that shoots from out of reach (a draw held and let go; an automatic held); the foe in its
 *           face first. It heads straight for its goal, hopping when no ground is gained, and leaves a foe it cannot
 *           reach for another (`stuck`: it has no pathfinding). Once no foe stands, it walks to the level's way on. No
 *           specials, no air strings, no dodge: the floor of play, not its ceiling
 *   still   holds no input at all: a level a player who does nothing wins is a level with no fight in it
 *
 *   playLevel(payload, { player?, seconds? }) → { player, outcome: 'success' | 'fail' | null, won, t, hp: { start, left },
 *     presses, shots, hitsBy: { <foe id>: n }, foes: [{ id, hp, start, down }], downs, stuck?: [what it could not reach], reason }
 *     payload  a level's resolved page payload (worlds/world-scene.js resolveWorldScene): its entities, events, colliders,
 *              faces, camera, game
 *   playthroughSummary(R) → one line a report reads
 *
 * Deterministic: the sim's fixed step, the world's seeded rules, the player a pure function of what it sees.
 */
import { steer, outcomeIn, SIM_DT, auditPath, faceGround, pageGroundFaces } from '../game/level-equivalence.js';
import { simLevel } from '../game/level-sim.js';

/** The level as the page runs it: its world with the page's own world options (the lock, the minds' tuning…), its bus,
 * its colliders and the page's ground. */
function pageSim(payload) {
  return simLevel({ entities: payload.entities || [], events: payload.events || {}, colliders: payload.colliders, camera: payload.camera, world: payload },
    { ground: faceGround(pageGroundFaces(payload.faces || [])), beat: payload.audio?.beat || null, powers: payload.game?.powers || null });
}

export const PLAYERS = Object.freeze(['basic', 'still']);
const TAU = Math.PI * 2;
const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : v);
const AXES = ['forward', 'strafe', 'turn', 'lookDX', 'lookDY', 'jump', 'jumpHeld', 'boost', 'fire', 'heavy', 'special', 'mod', 'guard', 'lock', 'kneel'];

// a person's pace: a press every quarter second through a string of three, a guard held between strings
const PRESS_EVERY = 8, STRING = 3, GUARD_FOR = 18, LOCK_EVERY = 12;
// the reach a string is pressed at (the blade's reach and a step), the range a lock is asked for
const STRIKE_AT = 2.2, LOCK_AT = 14, SHOOT_AT = 30, SHOOT_LOCK_AT = 45, LOCK_WAIT = 30;

const alive = (e) => !!(e && e.body && Number.isFinite(e.body.hp) && e.body.hp > 0 && !e.downed && e.deadAt == null);
const shoots = (e) => !!(e && (e.weapon?.fireClass || e.rule?.weapon?.fireClass));
const flat = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The hero's health as the level counts it: the level's own hp var, else the hero's body (the stats bind it there). */
function hpOf(sim, hero) {
  const v = sim.bus.vars || {};
  if (Number.isFinite(v.hp)) return v.hp;
  return Number.isFinite(hero?.body?.hp) ? hero.body.hp : null;
}

/** The input that heads the hero toward p, by its rule's own way of moving (a camera-relative hero by the camera's yaw). */
function steerTo(world, hero, p) {
  if (hero.rule?.move === 'camera') {
    const cam = world.entities.find((e) => e.isCamera), yaw = cam && Number.isFinite(cam.camYaw) ? cam.camYaw : hero.transform.heading || 0;
    const t = hero.transform.pos, want = Math.atan2(p[1] - t[1], p[0] - t[0]), rel = wrapPi(want - yaw);
    // (the runtime's camera move: forward along the yaw, strafe along its right, sin and -cos: rules-platform.js)
    return { forward: Math.cos(rel), strafe: -Math.sin(rel) };
  }
  return steer(hero, p);
}

/** The level's way on (a reach-exit that is not the way back), or null. */
function wayOn(contract) {
  const m = (contract?.mechanics ?? []).find((x) => x && x.kind === 'reach-exit' && x.exit !== 'back' && Array.isArray(x.at));
  if (m) return m.at;
  const pts = auditPath(contract).points;
  return pts.length ? pts[pts.length - 1] : null;
}

// a person's patience: a hop after a second with no ground gained, and a goal given up for another after STUCK_AFTER
const HOP_AFTER = 30, HOP_FOR = 6, STUCK_AFTER = 300;

/** Heads for `p` (a foe's id or the way on, `id`), as the win script does: a hop over what stands in the way when no ground
 * is gained for a second; a goal no nearer after STUCK_AFTER frames is named stuck (the player tries another). */
function approach(W, hero, M, p, id) {
  const inp = steerTo(W, hero, p), dist = flat(p, hero.transform.pos);
  if (M.goal !== id) { M.goal = id; M.best = dist; M.still = 0; M.since = 0; }
  if (dist < M.best - 0.05) { M.best = dist; M.still = 0; M.since = 0; } else { M.still++; M.since++; }
  if (M.still > HOP_AFTER) { M.hop = HOP_FOR; M.still = 0; }
  if (M.hop > 0) { inp.jump = 1; inp.jumpHeld = 1; M.hop--; }
  if (M.since > STUCK_AFTER) { M.stuck.add(id); M.goal = null; }
  return inp;
}

/** The basic player: a pure function of what it sees and its own memory (`M`). */
function basicInput(sim, hero, M, contract) {
  const W = sim.world, inp = {};
  const all = W.entities.filter((e) => e.team === 'foes' && alive(e));
  // (a foe it could not reach is left while another can be fought)
  const foes = all.some((e) => !M.stuck.has(e.id)) ? all.filter((e) => !M.stuck.has(e.id)) : all;
  const sidearm = hero.rule?.weapon || null;
  const d = (e) => flat(e.transform.pos, hero.transform.pos);
  // the foe it fights, as a person picks: the one in its face first (within a step of the blade's reach), then a shooter
  // its sidearm reaches, then the nearest
  foes.sort((a, b) => d(a) - d(b));
  const T = all.find((e) => d(e) <= STRIKE_AT + 1) ?? (sidearm && foes.find((e) => shoots(e) && d(e) < SHOOT_LOCK_AT)) ?? foes[0] ?? null;
  if (!T) {
    const exit = wayOn(contract);
    if (exit) Object.assign(inp, approach(W, hero, M, exit, 'the way on'));
    return inp;
  }
  const dist = d(T), locked = W.lock ? W.lock.target : null;
  // (the sidearm is turned on a shooter out of the blade's reach; beyond SHOOT_AT the player closes first, as a person
  // would: an arrow drops over a long flight)
  const shooting = !!(sidearm && shoots(T) && dist > STRIKE_AT * 2 && dist <= SHOOT_AT);
  // the lock: asked for (or cycled on) while it holds another, at most every LOCK_EVERY frames; out to the sidearm's
  // range when it shoots, else a fight's
  if (W.lock && locked !== T.id && dist < (shooting ? SHOOT_LOCK_AT : LOCK_AT) && M.k >= M.lockAt) { inp.lock = 1; M.lockAt = M.k + LOCK_EVERY; }
  // a shooter out of reach and a sidearm in hand: stand and shoot (a draw held past its time and let go; an automatic
  // held), once the lock holds it where the level has a lock (the sidearm aims at the locked foe)
  // (a lock that will not take, a shooter out of sight behind a wall: after LOCK_WAIT it closes on it instead)
  if (shooting && W.lock && locked !== T.id) M.lockWait++; else M.lockWait = 0;
  if (shooting && M.lockWait > LOCK_WAIT) { Object.assign(inp, approach(W, hero, M, T.transform.pos, T.id)); M.draw = 0; return inp; }
  if (shooting) {
    if (W.lock && locked !== T.id) { M.draw = 0; return inp; }
    if (sidearm.auto) { inp.special = 1; M.shots += M.k % 3 === 0 ? 1 : 0; return inp; }
    const hold = Math.ceil(((sidearm.chargeTime ?? 0.45) + 0.15) / SIM_DT), rest = Math.ceil(((sidearm.reload ?? 0.3) + 0.2) / SIM_DT);
    M.draw = (M.draw + 1) % (hold + rest);
    if (M.draw > 0 && M.draw <= hold) inp.special = 1;
    if (M.draw === hold + 1) M.shots++;
    return inp;
  }
  if (dist > STRIKE_AT) { Object.assign(inp, approach(W, hero, M, T.transform.pos, T.id)); M.beat = 0; M.next = M.k; return inp; }
  // in reach: a string at a person's pace, then the guard up until the next
  if (M.k >= M.next) {
    inp.fire = 1; M.presses++; M.beat++;
    M.next = M.k + (M.beat % STRING === 0 ? PRESS_EVERY + GUARD_FOR : PRESS_EVERY);
    M.guardFrom = M.beat % STRING === 0 ? M.k + PRESS_EVERY : Infinity;
  } else if (M.k >= M.guardFrom && M.k < M.next - 1) inp.guard = 1;
  return inp;
}

export function playLevel(payload, { player = 'basic', seconds = 180 } = {}) {
  if (!PLAYERS.includes(player)) throw new Error(`playthrough: player is ${PLAYERS.join(' or ')}`);
  const contract = payload?.game || {};
  const sim = pageSim(payload), W = sim.world, hero = W.byId[W.pilotId];
  if (!hero) return { player, outcome: null, won: false, t: 0, reason: 'the level has no hero to play' };
  const foes0 = W.entities.filter((e) => e.team === 'foes' && e.body && Number.isFinite(e.body.hp));
  const start = Object.fromEntries(foes0.map((e) => [e.id, e.body.hp]));
  const M = { k: 0, lockAt: 0, next: 0, beat: 0, guardFrom: Infinity, draw: 0, presses: 0, shots: 0, goal: null, best: Infinity, still: 0, since: 0, hop: 0, stuck: new Set(), lockWait: 0 };
  const hitsBy = {};
  // (the hp is read once the first frame has run: the stats bind the body's hp on it)
  let hp0 = null, outcome = null, t = 0;
  const n = Math.round(seconds / SIM_DT);
  for (let i = 0; i < n && !outcome; i++) {
    const inp = player === 'basic' ? basicInput(sim, hero, M, contract) : {};
    for (const k of AXES) sim.input[k] = inp[k] ?? 0;
    const h0 = hero.hits || 0, n0 = sim.bus.log.length;
    sim.frame(SIM_DT);
    if (hp0 == null) hp0 = hpOf(sim, hero);
    if ((hero.hits || 0) > h0) { const by = String(hero.lastHitBy ?? '?'); hitsBy[by] = (hitsBy[by] || 0) + ((hero.hits || 0) - h0); }
    outcome = outcomeIn(contract, sim.bus.log, n0);
    M.k++; t += SIM_DT;
  }
  const foes = foes0.map((e) => ({ id: e.id, start: start[e.id], hp: r1(Math.max(0, e.body.hp)), down: !alive(e) }));
  const downs = foes.filter((f) => f.down).length, hpLeft = hpOf(sim, hero);
  const stuck = [...M.stuck];
  const reason = outcome === 'success' ? 'won' : outcome === 'fail' ? 'the hero went down' : `not ended in ${seconds} s${stuck.length ? ` (could not reach ${stuck.join(', ')})` : ''}`;
  return { player, outcome, won: outcome === 'success', t: r1(t), hp: { start: hp0, left: r1(hpLeft) }, presses: M.presses, shots: M.shots, hitsBy, foes, downs, ...(stuck.length ? { stuck } : {}), reason };
}

/** One line for a report: won or lost, how long, the hp left, the foes downed and who hit the hero most. */
export function playthroughSummary(R) {
  if (!R) return null;
  const worst = Object.entries(R.hitsBy ?? {}).sort((a, b) => b[1] - a[1])[0];
  return `${R.player}: ${R.reason} at ${R.t} s, hp ${R.hp?.left ?? '?'}/${R.hp?.start ?? '?'}, ${R.downs}/${R.foes?.length ?? 0} foes down`
    + `${R.presses ? `, ${R.presses} presses` : ''}${R.shots ? `, ${R.shots} shots` : ''}${worst ? `, hit most by ${worst[0]} (${worst[1]})` : ''}`;
}
