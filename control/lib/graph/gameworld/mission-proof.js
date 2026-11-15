/**
 * THE MISSION'S PROOF (a machine gate, never the eyes'): a mission's tasks played on the bus, as the wave gauntlet's
 * are (gauntlet-proof.js). A walker is stood where each task wants it: each section walked into, each way on tried
 * while it is still sealed (it must put the walker back), each foe the mechanic wakes given its fall at once (the proof
 * cannot fight: said as assumed), the clock of a hold run out, the exit walked into. Proved when every task is done in
 * the order written, no way on opened early and the level's success fires. It shows the structure holds; not that a
 * fight can be won (the player's proof is on the runtime, the eyes' is in play).
 *
 *   proveMission(manifest) → { proved, done: [task ids], woke: [[ids]], sealed, says, assumed }
 *
 * THE MISSION PLAYED (the player's proof, a machine gate too): the level's resolved page payload stepped headless on the
 * runtime it ships (game/level-sim.js), by a player that gives input only, as the playthrough's do (playthrough.js):
 *   gunner   walks the mission (the laws' own grid, the walk to each task's place), stands and fires at what it sees
 *            down a clear line (the nearest first: the mouse brought onto it, the sights up past a room's length, an
 *            automatic in short bursts, the carried gun whose band the range is), reloads when nothing is in sight, takes health
 *            when it is low and a drop is near. No cover used, no flank, no knife: the floor of play
 *   still    holds no input: a mission a player who does nothing wins has no game in it
 *
 *   playMission(level, M, { player?, seconds? }) → { player, outcome, won, t, hp: { start, left }, shots, downs, foes,
 *     tasks: [ids done], at: <task in hand>, hpAt: { <task>: hp it was finished with }, reason }
 *     level: the level's manifest as stored, or its resolved page payload; M: the composition (missionLevel's `mission`)
 *   missionPlaySummary(R) → one line a report reads
 *   missionStageManifests(steps) → { manifests, keys }   each level's stage that carries a mission, from a run's steps
 *   proveMissions(world, manifests) → [{ level, proved, says, play, won, advice?, assumed }] | null   each mission level
 *     of a world, proved on the bus and played, on the manifests a run made ({ <level id>: its stage's manifest }); null
 *     for a world with none
 *
 * Pure and deterministic (the bus and the runtime are the same code the page runs; a fixed step).
 */
import { composeMechanics } from '../game/mechanics.js';
import { deriveLevelPlayer, synthesizeLevel, mergeEventManifests } from '../game/level-synth.js';
import { objectivesOf, objectiveNames } from '../game/objectives.js';
import { buildBus } from '../worlds/event-bus.js';
import { simLevel } from '../game/level-sim.js';
import { outcomeIn, SIM_DT, faceGround, pageGroundFaces } from '../game/level-equivalence.js';
import { walled } from './playthrough.js';
import { missionGrid, ARCHETYPE_BAND, BANDS } from '../mission/index.js';
import { ARMS_KIT } from './arms-kit.js';
import { readGameworld, resolveLevel } from './world.js';
import { missionPlan } from './mission-level.js';

const B = buildBus();

export function proveMission(manifest) {
  const mechs = manifest?.game?.mechanics ?? [], O = objectivesOf(mechs);
  if (!O) return { proved: false, done: [], woke: [], sealed: 0, says: 'the level lays no objectives', assumed: [] };
  const { player, spawn } = deriveLevelPlayer(manifest);
  const c = composeMechanics(mechs, { player, spawn, fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  const woke = [], won = Object.keys(c.on).filter((k) => c.on[k].end === 'success');
  let at = spawn.slice(), prev, warped = 0;
  const pump = (list) => {
    B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); }
    const ops = s._ctrlOps ?? []; s._ctrlOps = [];
    const spawned = ops.filter((o) => o.op === 'spawn').map((o) => o.who);
    // (a body put back by a sealed way stands where it was put)
    const back = s._ctrlWarps?.[player];
    if (back) { at = back.slice(); warped++; s._ctrlWarps = {}; }
    if (spawned.length) { woke.push(spawned); pump(spawned.map((id) => ({ type: 'down', entity: id }))); }
  };
  // the walker stood at a place: two frames, so a zone's edge is seen
  const stand = (to) => { at = to.slice(); for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: player, position: at }], prev, ev.sources); prev = z.prev; pump(z.events); } };
  const time = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
  pump(ev.initial ?? []);
  stand(at);
  let sealed = 0, early = 0;
  // (the task in hand is the mechanic's own var: a task is done when it moves on by one as that task is played)
  const cur = objectiveNames(O.id ?? 'obj').task, done = [];
  O.tasks.forEach((t, k) => {
    // the way on, tried before the task is met: a body put back, the way still shut
    if (t.door) { const w0 = warped; stand(t.door.at); if (warped > w0) sealed++; else early++; }
    if (t.zone) stand(t.zone.at);
    if (t.kind === 'take' || t.kind === 'reach') stand(t.at);
    if (t.kind === 'hold') time(t.seconds + 3);
    time(0.3);
    // through the way on, into the next section
    if (s.vars[cur] === k + 1) done.push(t.id);
    if (t.door) { const w0 = warped; stand(t.door.at); if (warped > w0) early++; }
  });
  const log = s.log.map((r) => r.type);
  const order = JSON.stringify(done) === JSON.stringify(O.tasks.map((t) => t.id)), win = won.some((t) => log.includes(t));
  const doors = O.tasks.filter((t) => t.door).length, proved = win && order && !early && sealed === doors;
  return {
    proved, done, woke, sealed,
    says: proved ? `${done.length} tasks done in the order written; ${doors} way${doors === 1 ? '' : 's'} on sealed until its task was met; ${woke.flat().length} foes woken by their own sections; the last task won it`
      : !order ? `the tasks were done as ${done.join(', ') || 'none'}, not as written (${O.tasks.map((t) => t.id).join(', ')})` : early ? `${early} way${early === 1 ? '' : 's'} on let a walker through before its task was met, or held it after` : sealed !== doors ? `${doors - sealed} sealed way${doors - sealed === 1 ? '' : 's'} on did not put the walker back` : 'the last task did not win the level',
    assumed: ['every foe\'s fall is given as it wakes (the proof cannot fight)', 'the walker is stood at each place (it does not walk)'],
  };
}

export const MISSION_PLAYERS = Object.freeze(['gunner', 'still']);
const TAU = Math.PI * 2, wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : v);
const flatD = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
const alive = (e) => !!(e && e.body && Number.isFinite(e.body.hp) && e.body.hp > 0 && !e.downed && e.deadAt == null && !e.dormant && !e.gone);
const INPUTS = ['forward', 'strafe', 'turn', 'lookDX', 'lookDY', 'jump', 'fire', 'aim', 'reload', 'slot'];
// a person's hand: the mouse at most this far a frame, a burst of an automatic and its rest (frames), the sights past this
const LOOK_MAX = 160, BURST = 3, REST = 5, AIM_PAST = 10, ON_TARGET = 0.03, LOW_HP = 45, LOW_MAG = 0.3;

/** The mission played (see the header). */
export function playMission(payload, M, { player = 'gunner', seconds = 300, trace = null } = {}) {
  if (!MISSION_PLAYERS.includes(player)) throw new Error(`mission: player is ${MISSION_PLAYERS.join(' or ')}`);
  // (a manifest as it is stored carries the recipe: its mechanics lowered here as the page's resolve lowers them, one
  // lowering: game/level-synth.js; a resolved payload carries them lowered already)
  if (payload?.game && !payload.game.on && Array.isArray(payload.game.mechanics)) {
    const S = synthesizeLevel(payload);
    payload = { ...payload, game: S.game, events: mergeEventManifests(payload.events ?? null, S.mechEvents) ?? {} };
  }
  const contract = payload?.game || {};
  const sim = simLevel({ entities: structuredClone(payload.entities || []), events: payload.events || {}, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces || [])) });
  const W = sim.world, hero = W.byId[W.pilotId];
  if (!hero) return { player, outcome: null, won: false, t: 0, reason: 'the level has no pilot to play' };
  const cur = objectiveNames('obj').task, tasks = M.sections.map((S) => S.id);
  const foes0 = W.entities.filter((e) => e.team === 'foes' && e.body && Number.isFinite(e.body.hp));
  // (the walk: the laws' grid, a body's width and a little off every box, the doors as they stand when open)
  const grid = missionGrid(M, { pad: 0.5 }), fields = new Map();
  const fieldTo = (at) => { const k = `${r1(at[0])},${r1(at[1])}`; if (!fields.has(k)) fields.set(k, grid.field(at)); return fields.get(k); };
  const stepToward = (goal, pos) => grid.toward(fieldTo(goal), pos, 6);
  const hpNow = () => (Number.isFinite(sim.bus.vars.hp) ? sim.bus.vars.hp : null);
  // (what lies on the floor, each taken once: walked over, it is gone)
  const drops = M.sections.flatMap((S) => S.drops.map((d) => ({ at: d.at, gives: d.gives, section: S.id, taken: false })));
  let k = 0, shots = 0, outcome = null, t = 0, hp0 = null, wasFire = 0, last = 0;
  const hpAt = {};
  // where the task in hand sends a body that sees nothing to shoot
  const goalOf = (n) => {
    const S = M.sections[Math.min(n, M.sections.length - 1)], T = S.task, begun = sim.bus.vars[`__obj_in${Math.min(n, M.sections.length - 1)}`] === 1;
    if (n >= M.sections.length) return M.anchors.exit;
    if (!begun) return [S.x[0] + 2.4, S.entry[1], 0];
    if (T.kind === 'take' || T.kind === 'reach') return T.at;
    if (T.kind === 'hold') return [S.line - 1, S.entry[1], 0];
    // a clear: toward the nearest of its foes still standing
    const left = S.foes.map((f) => W.byId[f.id]).filter(alive).sort((a, b) => flatD(a.transform.pos, hero.transform.pos) - flatD(b.transform.pos, hero.transform.pos));
    return left.length ? left[0].transform.pos : [S.x[1] - 2, S.door ? S.door.at[1] : 0, 0];
  };
  // the carried gun a range asks for, by each slot's band (the kit's archetype: mission/sections.js)
  const slots = (hero.rule?.loadout ?? []).map((sl) => ARCHETYPE_BAND[ARMS_KIT[sl.name]?.as] ?? (sl.weapon?.fireClass === 'lob' ? 'mid' : 'mid'));
  const slotFor = (d) => {
    if (slots.length < 2) return null;
    // (across a room the close gun; past it the longest gun carried, as a person reaches for the bigger one)
    const want = d <= BANDS.close.reach[1] ? ['close', 'mid', 'long'] : ['long', 'mid', 'close'];
    for (const b of want) { const k = slots.indexOf(b); if (k >= 0) return k; }
    return null;
  };
  const n = Math.round(seconds / SIM_DT);
  for (let i = 0; i < n && !outcome; i++) {
    const inp = {};
    if (player === 'gunner') {
      const me = hero.transform, w = hero.weapon, task = sim.bus.vars[cur] ?? 0;
      const seen = foes0.filter((e) => alive(e) && flatD(e.transform.pos, me.pos) < 60 && !walled(payload.colliders, hero, e)).sort((a, b) => flatD(a.transform.pos, me.pos) - flatD(b.transform.pos, me.pos));
      for (const d of drops) if (!d.taken && flatD(d.at, me.pos) < 1) d.taken = true;
      const sens = hero.rule.lookSens ?? 0.0025, dry = !!w && w.ammo === 0 && w.reserve === 0;
      const near = (gives) => drops.filter((d) => !d.taken && d.gives === gives && tasks.indexOf(d.section) <= task).sort((a, b) => flatD(a.at, me.pos) - flatD(b.at, me.pos))[0] ?? null;
      const walk = (goal) => {
        const step = stepToward(goal, me.pos);
        if (!step || flatD(step.at, me.pos) <= 0.15) return;
        const dy = wrapPi(Math.atan2(step.at[1] - me.pos[1], step.at[0] - me.pos[0]) - (me.heading || 0));
        inp.lookDX = Math.max(-LOOK_MAX, Math.min(LOOK_MAX, dy / sens)); inp.lookDY = Math.max(-LOOK_MAX, Math.min(LOOK_MAX, -(me.pitch || 0) / sens));
        inp.forward = Math.abs(dy) < 0.5 ? 1 : 0;
      };
      if (seen.length && !(dry && near('ammo'))) {
        // the mouse onto the nearest: its chest, from the eye
        const f = seen[0], p = f.transform.pos, egg = f.body.egg, d = flatD(p, me.pos);
        // (the eye: where the body stands for a body-less first person, over its feet for a hero)
        const eyeZ = me.pos[2] + (w?.eye ?? 0);
        const yaw = Math.atan2(p[1] - me.pos[1], p[0] - me.pos[0]), pitch = Math.atan2(p[2] + (egg ? egg.cz + 0.25 * egg.c : 1) - eyeZ, d);
        // (over the shoulder the rounds go where the camera's crosshair is, and the camera stands off the body's line: its
        // line crosses the body's `lead` metres out, so a foe nearer than that is held a little to the camera's side of
        // the body's line and one beyond it a little to the other: what a person does by putting the crosshair on it)
        const cam = w?.converge ? payload.camera : null;
        const off = cam && Number.isFinite(cam.shoulder) && Number.isFinite(cam.lead) ? (cam.shoulder * (cam.lead - d)) / (cam.lead + (cam.dist ?? 0)) : 0;
        const dy = wrapPi(yaw + Math.atan2(off, d) - (me.heading || 0)), dp = pitch - (me.pitch || 0);
        inp.lookDX = Math.max(-LOOK_MAX, Math.min(LOOK_MAX, dy / sens)); inp.lookDY = Math.max(-LOOK_MAX, Math.min(LOOK_MAX, dp / sens));
        if (d > AIM_PAST) inp.aim = 1;
        // the gun for the range: the close gun across a room, a longer one down a hall (1 to 5, as a person presses it)
        const want = slotFor(d);
        if (want != null && want !== (hero.loadoutIdx || 0) && !(hero.readyT > 0)) inp.slot = want + 1;
        const on = Math.abs(dy) < ON_TARGET && Math.abs(dp) < ON_TARGET;
        if (w && w.ammo === 0 && !w.reloading) inp.reload = 1;
        else if (on && w && !w.reloading) inp.fire = k % (BURST + REST) < BURST ? 1 : 0;
      } else {
        // nothing in sight: a magazine nearly spent is changed (never a full one: what is left in it is lost), then the
        // rounds when it is dry, the health when it is low, else the task in hand
        if (w && !w.reloading && w.ammo <= w.magazine * LOW_MAG && w.reserve !== 0) inp.reload = 1;
        const hp = hpNow(), heal = hp != null && hp < LOW_HP ? near('health') : null, rounds = w && w.reserve === 0 && w.ammo <= w.magazine * LOW_MAG ? near('ammo') : null;
        walk((rounds ?? heal)?.at ?? goalOf(task));
      }
    }
    for (const a of INPUTS) sim.input[a] = inp[a] ?? 0;
    if (inp.fire && !wasFire) shots++;
    wasFire = inp.fire ? 1 : 0;
    const n0 = sim.bus.log.length;
    sim.frame(SIM_DT);
    if (hp0 == null) hp0 = hpNow();
    outcome = outcomeIn(contract, sim.bus.log, n0);
    k++; t += SIM_DT;
    if (trace && k % 30 === 0) trace({ t: r1(t), task: tasks[sim.bus.vars[cur] ?? 0], hp: hpNow(), at: hero.transform.pos.map(r1), ammo: hero.weapon?.ammo, rel: !!hero.weapon?.reloading, res: hero.weapon?.reserve, inp, foes: foes0.filter(alive).map((e) => `${e.id}:${r1(e.body.hp)}@${e.transform.pos.slice(0, 2).map(r1).join(',')}${walled(payload.colliders, hero, e) ? 'W' : ''}`).join(' ') });
    // (the hp each task was finished with: where a mission costs)
    const now = sim.bus.vars[cur] ?? 0;
    if (now > last) { for (let j = last; j < now; j++) hpAt[tasks[j]] = r1(hpNow()); last = now; }
  }
  const at = Math.min(sim.bus.vars[cur] ?? 0, tasks.length), foes = foes0.map((e) => ({ id: e.id, hp: r1(Math.max(0, e.body.hp)), down: !alive(e) && !e.dormant }));
  const reason = outcome === 'success' ? 'won' : outcome === 'fail' ? `went down at ${tasks[at] ?? 'the end'}` : `not ended in ${seconds} s, at ${tasks[at] ?? 'the end'}`;
  return { player, outcome, won: outcome === 'success', t: r1(t), hp: { start: hp0, left: r1(hpNow()) }, shots, downs: foes.filter((f) => f.down).length, foes: foes.length, tasks: tasks.slice(0, at), at: tasks[at] ?? null, hpAt, reason };
}

/** One line for a report. */
export function missionPlaySummary(R) {
  return R ? `${R.player}: ${R.reason} at ${R.t} s, hp ${R.hp?.left ?? '?'}/${R.hp?.start ?? '?'}, ${R.tasks.length} task${R.tasks.length === 1 ? '' : 's'} done, ${R.downs}/${R.foes} foes down${R.shots ? `, ${R.shots} bursts` : ''}` : null;
}

/** Each level's stage that carries a mission, from runSteps' steps (`level-<id>-<k>`): the first stage of its level whose
 * page carries one. → { manifests: { <level id>: manifest }, keys: { <level id>: the step's key } } */
export function missionStageManifests(steps) {
  const manifests = {}, keys = {};
  for (const s of steps) {
    const m = /^level-(.+)-(\d+)$/.exec(s.key);
    if (m && s.order?.manifest?.mission && !manifests[m[1]]) { manifests[m[1]] = s.order.manifest; keys[m[1]] = s.key; }
  }
  return { manifests, keys };
}

/** Each mission level of a world, proved on the bus and played by the gunner, or null for a world with none. */
export function proveMissions(world, manifests) {
  const G = readGameworld(world), ids = G.ids.filter((id) => G.levels[id].mission !== undefined);
  if (!ids.length) return null;
  return ids.map((id) => {
    const m = manifests[id];
    if (!m) return { level: id, proved: false, says: 'no stage made for it', assumed: [] };
    const P = proveMission(m), plan = missionPlan(G, resolveLevel(G, id).mission), R = playMission(m, plan.mission);
    // (a level the floor of play loses: where, and the dials that move it; advice, never a refusal)
    const advice = R.won ? null : `the gunner ${R.reason}: fewer foes there (mission.foes), a shorter hold (mission.hold, mission.waves), or a gun carried for that section's band`;
    return { level: id, proved: P.proved, says: P.says, play: missionPlaySummary(R), won: R.won, ...(advice ? { advice } : {}), assumed: P.assumed };
  });
}
