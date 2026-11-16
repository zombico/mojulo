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
 *   gunner   walks the mission (the laws' own grid, the walk to each task's place; on a map the map's own graph: the
 *            way between its cells, arena-map/phases.js mapRoute, steered cell centre to cell centre, up its ramps and
 *            its ladders, off an edge only where the way drops), stands and fires at what it sees
 *            down a clear line (the nearest first: the mouse brought onto it, the sights up past a room's length, an
 *            automatic in short bursts, the carried gun whose band the range is), reloads when nothing is in sight, takes health
 *            when it is low and a drop is near. No cover used, no flank, no knife: the floor of play
 *   still    holds no input: a mission a player who does nothing wins has no game in it
 *
 *   playMission(level, M, { player?, seconds?, map? }) → { player, outcome, won, t, hp: { start, left }, shots, downs, foes,
 *     tasks: [ids done], at: <task in hand>, hpAt: { <task>: hp it was finished with }, reason }
 *     level: the level's manifest as stored, or its resolved page payload; M: the composition (missionLevel's `mission`);
 *     map: the blocks a mission on a map is fought on (else the ones its manifest carries: mission.plan.map)
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
import { missionPlan, missionMapOf } from './mission-level.js';
import { indexMap } from '../arena-map/map.js';
import { mapRoute, nodeAt } from '../arena-map/phases.js';
import { mapPoint } from '../arena-map/ground.js';
import { asksLevel, withBuildingLevel } from '../structure/level.js';
import { buildNav } from '../worlds/controllable/nav.js';
import { missionBuildingStage } from './levels.js';
import { industrialPlan } from './mission-industrial.js';

// the walkers' own pathfinder (worlds/controllable/nav.js: A* over the colliders on one floor, string-pulled), for a
// mission in a building: a floor at a time, its storeys joined by its stairs' own ways
const NAV = {};
buildNav(NAV);
// (a building level's stage carries its level unlowered, `level: { … }`: lowered here as the page's read lowers it)
const lowered = (m) => (m && !m.game && asksLevel(m) ? withBuildingLevel(m, m.game?.levelRef ?? 'proof') : m);

const B = buildBus();

export function proveMission(manifest0) {
  const manifest = lowered(manifest0), mechs = manifest?.game?.mechanics ?? [], O = objectivesOf(mechs);
  if (!O) return { proved: false, done: [], woke: [], sealed: 0, says: 'the level lays no objectives', assumed: [] };
  const { player, spawn } = deriveLevelPlayer(manifest);
  const c = composeMechanics(mechs, { player, spawn, fall: 'none' }), ev = c.events, s = B.createBusState(ev, ev.entities);
  const woke = [], won = Object.keys(c.on).filter((k) => c.on[k].end === 'success');
  let at = spawn.slice(), prev, warped = 0;
  // (a task is done when the mechanic's var moves on past it: a task that begins as the one before is met may be done in
  // the same breath, its foes' falls given as they wake)
  const cur = objectiveNames(O.id ?? 'obj').task, done = [];
  const pump = (list) => {
    B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); }
    while (done.length < Math.min(O.tasks.length, s.vars[cur] ?? 0)) done.push(O.tasks[done.length].id);
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
  O.tasks.forEach((t) => {
    // the way on, tried before the task is met: a body put back, the way still shut
    if (t.door) { const w0 = warped; stand(t.door.at); if (warped > w0) sealed++; else early++; }
    if (t.zone) stand(t.zone.at);
    if (t.kind === 'take' || t.kind === 'reach') stand(t.at);
    if (t.kind === 'hold') time(t.seconds + 3);
    time(0.3);
    // through the way on, into the next section
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
export function playMission(payload, M, { player = 'gunner', seconds = 300, trace = null, map = null } = {}) {
  if (!MISSION_PLAYERS.includes(player)) throw new Error(`mission: player is ${MISSION_PLAYERS.join(' or ')}`);
  // (a manifest as it is stored carries the recipe: its mechanics lowered here as the page's resolve lowers them, one
  // lowering: game/level-synth.js; a resolved payload carries them lowered already)
  payload = lowered(payload);
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
  // (the walk: down one line the laws' grid, a body's width and a little off every box, the doors as they stand when
  // open; on a map the map's own ways, cell to cell, toward the next cell's centre on the way)
  const onMap = M.on === 'map', inBuilding = M.on === 'building', free = onMap || inBuilding, blocks = onMap ? map ?? missionMapOf(payload)?.blocks ?? null : null;
  if (onMap && !blocks) return { player, outcome: null, won: false, t: 0, reason: 'a mission on a map is walked on its blocks: none given, none carried' };
  if (inBuilding && !Array.isArray(payload.faces)) return { player, outcome: null, won: false, t: 0, reason: 'a mission in a building is played on its resolved page (its treads, its floors): the stored stage carries none' };
  const grid = free ? null : missionGrid(M, { pad: 0.5 }), fields = new Map(), I = onMap ? indexMap(blocks) : null, routes = new Map();
  // IN A BUILDING: the way to a place, a floor at a time (the runtime's own nav on the page's colliders at that floor),
  // up or down a stair by its own way (its approach, its flights and landing, its arrival); planned once a goal and again
  // when the body has not come nearer its next point for a while
  const F = inBuilding ? M.frame : null, eyeH = hero.rule?.eye ?? 0;
  const storeyAt = (z) => { let k = 0; (F?.floors ?? [0]).forEach((f, s) => { if (f <= z + 0.6) k = s; }); return k; };
  let way = null, wayKey = null, best = Infinity, stuck = 0;
  const floorWay = (a, b, s) => { const p = NAV.navPath({ colliders: payload.colliders }, [a[0], a[1]], [b[0], b[1]], { radius: 0.4, height: 1.6, footZ: F.floors[s], step: 0.35, cell: 0.25 }); return p && p.length ? p.map((q) => [q[0], q[1], F.floors[s]]) : [[b[0], b[1], F.floors[s]]]; };
  const planWay = (from, goal) => {
    const s0 = storeyAt(from[2] - eyeH), s1 = storeyAt(goal[2]);
    if (s0 === s1) return floorWay(from, goal, s0);
    // (the stair between the two storeys nearest the body: its way up, or down reversed)
    const up = s1 > s0, z0 = F.floors[Math.min(s0, s1)], z1 = F.floors[Math.max(s0, s1)];
    const st = F.stairs.filter((x) => Math.abs(x.z0 - z0) < 0.05 && Math.abs(x.z1 - z1) < 0.05).map((x) => (up ? x.way : [...x.way].reverse()))
      .sort((a, b) => flatD(a[0], from) - flatD(b[0], from))[0];
    if (!st) return floorWay(from, goal, s0);
    // (to its foot on this floor, along it, then on from its head on the next: planned again once there)
    return [...floorWay(from, st[0], s0), ...st.slice(1).map((q, i, arr) => [q[0], q[1], i === arr.length - 1 ? F.floors[s1] : null])];
  };
  const fieldTo = (at) => { const k = `${r1(at[0])},${r1(at[1])}`; if (!fields.has(k)) fields.set(k, grid.field(at)); return fields.get(k); };
  const stepToward = (goal, pos) => {
    if (inBuilding) {
      const k = `${r1(goal[0])},${r1(goal[1])},${r1(goal[2])}`;
      if (k !== wayKey || !way || !way.length) { way = planWay(pos, goal); wayKey = k; best = Infinity; stuck = 0; }
      while (way.length > 1 && flatD(way[0], pos) < 0.5) { way.shift(); best = Infinity; stuck = 0; }
      // (no nearer its next point for two seconds: planned again from where it stands)
      const d = flatD(way[0], pos);
      if (d < best - 0.05) { best = d; stuck = 0; } else if (++stuck > 2 / SIM_DT) { way = planWay(pos, goal); best = Infinity; stuck = 0; }
      return { at: way[0] };
    }
    if (!onMap) return grid.toward(fieldTo(goal), pos, 6);
    // (a map laid off the world's origin, a site's: `M.origin`, where its first cell's corner stands)
    const O = M.origin ?? [0, 0, 0], a = nodeAt(I, pos, hero.rule?.eye ?? 0, O), b = nodeAt(I, [goal[0], goal[1], goal[2] + 0.5], 0, O);
    if (!a || !b || a === b) return { at: goal };
    const k = `${a}>${b}`;
    if (!routes.has(k)) routes.set(k, mapRoute(I, a, b));
    const R = routes.get(k);
    return { at: R && R.length > 1 ? mapPoint(I.at.get(R[1]), O) : goal };
  };
  const hpNow = () => (Number.isFinite(sim.bus.vars.hp) ? sim.bus.vars.hp : null);
  // (what lies on the floor, each taken once: walked over, it is gone)
  const drops = M.sections.flatMap((S) => S.drops.map((d) => ({ at: d.at, gives: d.gives, section: S.id, taken: false })));
  let k = 0, shots = 0, outcome = null, t = 0, hp0 = null, wasFire = 0, last = 0;
  const hpAt = {};
  // where the task in hand sends a body that sees nothing to shoot
  const goalOf = (n) => {
    const S = M.sections[Math.min(n, M.sections.length - 1)], T = S.task, begun = sim.bus.vars[`__obj_in${Math.min(n, M.sections.length - 1)}`] === 1;
    if (n >= M.sections.length) return M.anchors.exit;
    if (!begun && !free) return [S.x[0] + 2.4, S.entry[1], 0];
    if (T.kind === 'take' || T.kind === 'reach') return T.at;
    if (T.kind === 'hold') return free ? T.at : [S.line - 1, S.entry[1], 0];
    // a clear: toward the nearest of its foes still standing
    const left = S.foes.map((f) => W.byId[f.id]).filter(alive).sort((a, b) => flatD(a.transform.pos, hero.transform.pos) - flatD(b.transform.pos, hero.transform.pos));
    return left.length ? left[0].transform.pos : free ? S.entry : [S.x[1] - 2, S.door ? S.door.at[1] : 0, 0];
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
      // (on a ladder the climb holds the body and its facing: a person finishes the climb before it fights)
      if (seen.length && !hero.climbing && !(dry && near('ammo'))) {
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

/** Each mission level of a world, proved on the bus and played by the gunner, or null for a world with none. A mission in
 * a building is played on its resolved page (`payloads`: { <level id>: the payload resolveWorldScene made of its
 * manifest }), its treads and its floors being the page's; with none at hand it is proved on the bus and its play said
 * to wait on the page. */
export function proveMissions(world, manifests, { payloads = {} } = {}) {
  const G = readGameworld(world), ids = G.ids.filter((id) => G.levels[id].mission !== undefined || G.levels[id].industrial !== undefined);
  if (!ids.length) return null;
  return ids.map((id) => {
    const m = manifests[id];
    if (!m) return { level: id, proved: false, says: 'no stage made for it', assumed: [] };
    if (G.levels[id].industrial !== undefined) {
      // (an industrial level: its yard designed again from its words, as the level laid it; played on its page where at
      // hand, since its ground and what stands on it are the place's own, built by the geocube)
      const P = proveMission(m), R0 = resolveLevel(G, id).industrial, plan = industrialPlan(G, R0.I, { spec: R0.spec, seed: R0.seed }), page = payloads[id] ?? null;
      const R = page ? playMission(page, plan.mission) : null;
      const advice = R && !R.won ? `the gunner ${R.reason}: fewer foes there (mission.foes), a shorter hold (mission.hold, mission.waves), or a gun carried for that section's band` : null;
      return { level: id, proved: P.proved, says: P.says, play: R ? missionPlaySummary(R) : 'not played: an industrial level is played on its resolved page (the place the geocube builds), not at hand here', ...(R ? { won: R.won } : {}), ...(advice ? { advice } : {}), assumed: P.assumed };
    }
    if (G.levels[id].building !== undefined) {
      // (in a building: the phases placed again from its plan, as the level laid them; played on its page where at hand)
      const P = proveMission(m), plan = missionBuildingStage(G, resolveLevel(G, id), id).mission, page = payloads[id] ?? null;
      const R = page ? playMission(page, plan.mission) : null;
      const advice = R && !R.won ? `the gunner ${R.reason}: fewer foes there (mission.foes), a shorter hold (mission.hold, mission.waves), or a gun carried for that section's band` : null;
      return { level: id, proved: P.proved, says: P.says, play: R ? missionPlaySummary(R) : 'not played: a mission in a building is played on its resolved page (its treads and floors), not at hand here', ...(R ? { won: R.won } : {}), ...(advice ? { advice } : {}), assumed: P.assumed };
    }
    // (a mission on a map is planned on the blocks its level carries: never regrown)
    const P = proveMission(m), carried = missionMapOf(m), plan = missionPlan(G, { ...resolveLevel(G, id).mission, ...(carried ? { grown: carried.blocks } : {}) }), R = playMission(m, plan.mission);
    // (a level the floor of play loses: where, and the dials that move it; advice, never a refusal)
    const advice = R.won ? null : `the gunner ${R.reason}: fewer foes there (mission.foes), a shorter hold (mission.hold, mission.waves), or a gun carried for that section's band`;
    return { level: id, proved: P.proved, says: P.says, play: missionPlaySummary(R), won: R.won, ...(advice ? { advice } : {}), assumed: P.assumed };
  });
}
