/**
 * THE LEVELS MADE PLAYABLE — each stage of a gameworld's levels as a world the hero pilots. A level is laid as one walk
 * of stages (level/sequential.js), and a stage is already a walkable world kind (`stage`, era/stage.js): its ground,
 * its colliders, its first-person spawn, the beats of its trail or the tiers of its climb. This puts the hero on it as
 * the pilot (playscape/player.js, without the player test's floor), spawned where the stage spawns a walker, facing the
 * way out, with the systems' play block (the stats, the HUD, the powers on their keys), and a `game` channel whose exit
 * is the stage's own end: a trail's exit beat, a climb's top tier. One game level per stage, in walking order; a level's
 * stages are not joined into one world.
 *
 * WALKABLE, NOT BEATABLE. What a stage's construction gives is ground the hero stands on from the spawn; whether a level
 * can be beaten (the moves, the numbers, the obstacles, the timing) is the creator's to judge in play. Nothing here
 * claims it.
 *
 *   gameStages(G)                          → [{ level, node, section, index, manifest }] every stage, the start level first
 *   stageEnds(manifest)                    → { spawn, heading, exit, exitFrom } read off the laid stage
 *   stageLevelOrder(G, stage, { ref, heroRef, mechanics, title }) → the create_sketch call that makes it
 *   gameStore(G, book)                     → the create_game store: the hero, the gear, the campaign
 *
 * Pure (the stage is assembled to read its ends; nothing is stored).
 */
import { readGameworld, resolveLevel } from './world.js';
import { layLevel } from '../level/index.js';
import { assembleStageScene, planStage } from '../era/stage.js';
import { withGeocube } from '../era/geocube.js';
import { playerWorld } from '../playscape/player.js';
import { resolveEquipment } from './equipment.js';
import { withBuildingLevel, PROBE } from '../structure/level.js';
import { withProgram } from '../era/programs.js';
import { buildNav } from '../worlds/controllable/nav.js';

const EYE_FALLBACK = 1.7;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Every stage of every level, the start level first, then the rest in the world's order. */
export function gameStages(world) {
  const G = readGameworld(world), order = [G.start, ...G.ids.filter((id) => id !== G.start)], out = [];
  for (const level of order) {
    const R = resolveLevel(G, level);
    // a building level is one stage: its rooms laid from its program (or the building already made, by ref)
    if (R.building) { out.push({ level, node: 'building', section: 'building', index: 0, building: R.building, manifest: R.building.ref ? null : buildingStage(R.building) }); continue; }
    const laid = layLevel(R.level);
    // the level's buildings stand on the section they name, or on its first trail
    const home = (b) => b.node ?? laid.stages.find((s) => s.section === 'trail')?.node;
    laid.stages.forEach((s, i) => {
      const here = (R.buildings ?? []).filter((b) => home(b) === s.node).map(({ node: _n, ...b }) => b);
      // the town's street stands on the first trail
      const street = R.street && s.node === laid.stages.find((x) => x.section === 'trail')?.node ? { ...R.street, seed: R.seed } : null;
      const manifest = here.length || street ? { ...s.manifest, ...(here.length ? { buildings: here } : {}), ...(street ? { town: street } : {}) } : s.manifest;
      out.push({ level, node: s.node, section: s.section, index: i, manifest });
    });
    // the insides of the buildings whose scene changes at the door: each a level of its own, after the level's stages,
    // linked by its door (the outside's `door` ↔ the inside's `out`)
    let k = laid.stages.length;
    for (const st of out.filter((x) => x.level === level && (x.manifest?.buildings || x.manifest?.town))) {
      for (const d of stageEnds(st.manifest).doors ?? []) {
        out.push({ level, node: `${st.node}-${d.id}`, section: 'interior', index: k++, outside: { node: st.node, index: st.index, door: d.id }, building: { use: d.inside.use }, manifest: interiorStage(d.inside) });
      }
    }
  }
  return out;
}

/** Where a stage spawns the hero and where it ends, read off the stage as it lays (drawn once per stage recipe: a
 * stage is pure, so the same recipe always ends the same). */
const ENDS = new Map();
export function stageEnds(manifest) {
  const key = JSON.stringify(manifest);
  if (!ENDS.has(key)) { if (ENDS.size > 64) ENDS.clear(); ENDS.set(key, readEnds(manifest)); }
  return ENDS.get(key);
}
function readEnds(manifest) {
  const P = assembleStageScene(manifest), walk = P.walk ?? {};
  if (!Array.isArray(walk.spawn)) throw new Error(`levels: the stage '${manifest.trail?.id ?? manifest.meru?.id ?? '?'}' lays no spawn to put the hero at`);
  const eye = Number.isFinite(walk.minEye) ? walk.minEye : EYE_FALLBACK;
  const spawn = [r3(walk.spawn[0]), r3(walk.spawn[1]), r3(walk.spawn[2] - eye)];
  const anchors = P.anchors ?? [];
  let exit = null, exitFrom = null, via = null;
  // a building that holds the level's end: its goal room, reached through its door and doorways
  const holds = anchors.find((a) => a.kind === 'building' && a.isGoal);
  if (holds) {
    exit = [holds.goalAt[0], holds.goalAt[1], holds.goalAt[2]]; exitFrom = `the ${holds.use}'s ${holds.goal}`;
    // from the spawn up the trail (it climbs where the land does: a straight line would cross its cliffs) to the beat
    // nearest the door, then round what stands between (the street's other houses) to the door: the walkers' own
    // pathfinder, at the height of that beat
    const own0 = manifest.trail ? `out-trail:${manifest.trail.id}` : null;
    const line = anchors.filter((a) => a.kind === 'beat' && (!own0 || a.trail === own0) && Number.isFinite(a.s)).sort((a, b) => a.s - b.s);
    const door = holds.route[0], d2 = (a) => (a.at[0] - door[0]) ** 2 + (a.at[1] - door[1]) ** 2;
    const k = line.reduce((m, a, i) => (m < 0 || d2(a) < d2(line[m]) ? i : m), -1);
    const up = k >= 0 ? line.slice(0, k + 1).map((a) => [r3(a.at[0]), r3(a.at[1])]) : [];
    const from = k >= 0 ? line[k].at : spawn;
    const N = {}; buildNav(N);
    const path = N.navPath({ colliders: P.colliders ?? [] }, from, door, { radius: 0.7, height: 1.8, footZ: from[2], step: 0.35, cell: 0.5 });
    via = [...up, ...(path && path.length ? path.slice(0, -1).map((q) => q.map(r3)) : []), ...holds.route];
  }
  // a trail: the exit beat of its own trail (the pages after the first also carry the trail before it)
  const own = manifest.trail ? `out-trail:${manifest.trail.id}` : null;
  const beat = anchors.find((a) => a.kind === 'beat' && a.beat === 'exit' && (!own || a.trail === own));
  if (beat && !holds) { exit = beat.at; exitFrom = 'the trail\'s exit beat'; }
  // a climb: its highest tier (the top it is climbed for)
  if (!exit) {
    const tiers = anchors.filter((a) => a.kind === 'tier' && Array.isArray(a.at));
    const top = tiers.reduce((m, a) => (!m || a.at[2] > m.at[2] ? a : m), null);
    if (top) { exit = top.at; exitFrom = `the climb's top tier, ${top.id}`; }
  }
  if (!exit) throw new Error('levels: the stage lays neither a trail exit nor a climb\'s tiers to end at');
  exit = exit.map(r3);
  // facing the way on: a trail's next beat past where the hero stands (it winds), a climb's foot; else the exit itself
  const d2 = (a) => (a.at[0] - spawn[0]) ** 2 + (a.at[1] - spawn[1]) ** 2;
  const ahead = beat
    ? anchors.filter((a) => a.kind === 'beat' && a.trail === own && Number.isFinite(a.s) && d2(a) > 16).sort((a, b) => a.s - b.s)[0]
    : anchors.filter((a) => a.kind === 'tier' && Array.isArray(a.at) && d2(a) > 16).sort((a, b) => a.at[2] - b.at[2])[0];
  const toward = ahead?.at ?? exit;
  const heading = r3(Math.atan2(toward[1] - spawn[1], toward[0] - spawn[0]));
  // what lies along the way: the trail's own beats (in order) and its hazards, for a goal to be placed on
  const beats = beat ? anchors.filter((a) => a.kind === 'beat' && a.trail === own && Number.isFinite(a.s)).sort((a, b) => a.s - b.s).map((a) => ({ beat: a.beat, at: a.at.map(r3) })) : [];
  const hazards = anchors.filter((a) => a.kind === 'hazard' && Array.isArray(a.at) && (!own || a.trail === own)).map((a) => ({ id: a.id, at: a.at.map(r3) }));
  // a climb's top is reached by climbing, so its zone is a volume: standing beneath the top is not reaching it
  // the doors of its buildings whose scene changes there (stage-buildings.js): each a `door` mechanic, its inside a level
  const doors = anchors.filter((a) => a.door && a.enter === 'door').map((a) => ({ ...a.door, inside: a.inside }));
  const storeyed = anchors.some((a) => a.kind === 'building' && a.storeys);
  return { spawn, heading, exit, exitFrom, planar: !!beat && !holds, beats, hazards, ...(via ? { via } : {}), ...(doors.length ? { doors } : {}), ...(storeyed ? { storeyed } : {}) };
}

/**
 * The call that makes one stage a game level: `create_sketch` of the stage with the hero as the pilot, the systems'
 * play block and inputs (when the world has systems), and `game: { levelRef, mechanics: [reach-exit], fall }`.
 * `mechanics` is resolveMechanics' result (or null); `ref` the level's own sketch ref (its levelRef).
 */
export function stageLevelOrder(G, stage, { ref, heroRef, mechanics = null, title, goal } = {}) {
  if (stage.section === 'building' || stage.section === 'interior') return buildingLevelOrder(G, stage, { ref, heroRef, mechanics, title, goal: stage.section === 'interior' ? null : goal });
  const ends = stageEnds(stage.manifest);
  const name = title ?? `${G.name ?? G.id} · ${stage.level} · ${stage.node}`;
  const controls = `W / S  ${heroRef ? 'run' : 'walk'} · A / D  turn${heroRef ? ' · Space  jump' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const doorMechs = (ends.doors ?? []).map(({ inside: _i, ...d }) => ({ kind: 'door', ...d }));
  const game = { levelRef: ref, mechanics: [...doorMechs, ...(goal ? goal(ends) : [{ kind: 'reach-exit', at: ends.exit, radius: 2.5, ...(ends.planar ? {} : { planar: false }), ...(ends.via ? { via: ends.via } : {}) }])], fall: { mode: 'respawn' } };
  let pilotPart;
  if (heroRef) {
    const P = playerWorld({ heroRef, id: 'hero', title: name, controls });
    const events = { ...(P.events || {}), ...(mechanics?.inputs?.length ? { inputs: [...(P.events?.inputs ?? []), ...mechanics.inputs] } : {}) };
    pilotPart = { figures: P.figures, entities: [{ ...P.entities[0], transform: { pos: ends.spawn, heading: ends.heading } }], camera: P.camera, events };
  } else {
    // FIRST PERSON: no hero; you are the camera, a walker held at the stage's own eye height (with a body the
    // walls of the stage's buildings stop, when it has any)
    const P = playerWorld({ heroRef: 'none', id: 'player', title: name, controls });   // for its legend only: no figure is kept
    pilotPart = {
      // (a building on storeys: it looks for its ground over its feet, so it climbs the treads, never onto the floor above)
      entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: 4.5, turn: 2.4, eye: EYE_FALLBACK, ...(stage.manifest.buildings ? { collideRadius: 0.3 } : {}), ...(ends.storeyed ? { probe: PROBE } : {}) }, body: { type: 'none' }, transform: { pos: [ends.spawn[0], ends.spawn[1], ends.spawn[2] + EYE_FALLBACK], heading: ends.heading } }],
      camera: { rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2 },
      events: P.events || {},
    };
  }
  const manifest = { ...stage.manifest, title: name, ...pilotPart, ...(mechanics?.play ? { play: mechanics.play } : {}), game };
  return { tool: 'create_sketch', args: { title: name, manifest }, ends };
}

/**
 * The game's store, from the book: the hero (a character slice, started at the systems' base numbers), the gear (an
 * inventory slice, when the table has a filled class), the campaign (a progression slice: each level unlocks the next).
 * `book` is resolveBook's.
 */
export function gameStore(world, book) {
  const G = readGameworld(world), S = book?.mechanics?.play.stats;
  const stats = S ? Object.fromEntries(S.stats.filter((x) => Number.isFinite(x.base ?? x.value)).map((x) => [x.id, x.base ?? x.value])) : {};
  const slices = [{ name: 'hero', kind: 'character', ...(Object.keys(stats).length ? { init: { stats } } : {}) }];
  if (resolveEquipment(G).rows.some((r) => r.build)) slices.push({ name: 'gear', kind: 'inventory' });
  slices.push({ name: 'campaign', kind: 'progression' });
  return { slices };
}

/** The create_game `levels` list: the stages' level refs in walking order, each after the first unlocked by the one
 * before it (`refs` in the order of gameStages). */
export function gameLevels(stages, refs) {
  // an inside is entered by its door, never gated; the walk's stages unlock each other in order, skipping insides
  const prev = (i) => { for (let j = i - 1; j >= 0; j--) if (stages[j].section !== 'interior') return j; return -1; };
  return stages.map((s, i) => ({ ref: refs[i], title: `${s.level} · ${s.node}`, ...(s.section !== 'interior' && prev(i) >= 0 ? { gate: { completed: refs[prev(i)] } } : {}) }));
}

/** The inside of a building entered by its door: its program on its room kit, played from its door `out` (which
 *  leads back out) to its goal room. */
export function interiorStage(inside) {
  const anchor = typeof inside.civilization === 'string' ? inside.civilization : undefined;
  return {
    kind: 'stage', kit: inside.kit ?? roomKitFor(anchor),
    program: { use: inside.use, seed: inside.seed ?? 1, ...(inside.rooms ? { rooms: inside.rooms } : {}), ...(inside.add ? { add: inside.add } : {}), ...(inside.civilization !== undefined ? { civilization: inside.civilization } : {}) },
    level: { door: 'out' },
  };
}

/** The game's door links: each inside's `out` paired with its building's door on the stage outside. */
export function gameLinks(stages, refs) {
  return stages.flatMap((s, i) => {
    if (s.section !== 'interior') return [];
    const o = stages.findIndex((x) => x.level === s.level && x.index === s.outside.index);
    return o < 0 ? [] : [{ from: { ref: refs[o], door: s.outside.door }, to: { ref: refs[i], door: 'out' } }];
  });
}

/** The room kit a building is laid in when it names none: a lab's for a shell language, else the stone. */
const roomKitFor = (anchor) => (anchor === 'shell' ? 'research-lab' : 'gothic-stone');

/** A building level's stage recipe: its program in its civilization's language, dressed by its kit or cube. */
export function buildingStage(B) {
  const { use, seed, rooms, add, kit, geocube, goal, from, anchor } = B;
  return {
    kind: 'stage',
    ...(geocube !== undefined ? { geocube } : { kit: kit ?? roomKitFor(anchor) }),
    program: { use, seed, ...(rooms ? { rooms } : {}), ...(add ? { add } : {}), ...(anchor !== undefined ? { civilization: anchor } : {}) },
    level: { ...(goal !== undefined ? { goal } : {}), ...(from !== undefined ? { from } : {}) },
  };
}

/**
 * A building level's create_sketch call: the stage laid from its program, with `level` (lowered on every read into
 * its game channel: the goal room, the route through its doorways). With a hero, the hero pilots it from the way in
 * (the stage is metres, as the hero is); without one, the level's own first-person walker. A building by ref is not
 * made here: the game plays it as it was made.
 */
function buildingLevelOrder(G, stage, { ref, heroRef, mechanics = null, title, goal = null } = {}) {
  const name = title ?? `${G.name ?? G.id} · ${stage.level}`;
  let base = { ...stage.manifest, title: name, ...(mechanics?.play ? { play: mechanics.play } : {}) };
  const lowered = withBuildingLevel(base, ref), walker = lowered.entities[0], eye = walker.rule.eye ?? EYE_FALLBACK;
  const spawn = [walker.transform.pos[0], walker.transform.pos[1], r3(walker.transform.pos[2] - eye)], heading = walker.transform.heading;
  // the rooms between the way in and the goal stand in for a trail's beats: a quick goal's pickups lie in them
  // (on storeys, each at its room's floor)
  const plan = withProgram(stage.manifest), floors = plan.rooms.some((r) => r.storey) ? new Map(planStage(plan.geocube !== undefined ? withGeocube(plan) : plan).rooms.map((r) => [r.id, r.z0])) : null;
  const beats = plan.rooms.filter((r) => r.id !== plan._program.entry && r.id !== plan._program.goal)
    .map((r) => ({ beat: r.id, at: [r.x + r.w / 2, r.y + r.d / 2, floors ? floors.get(r.id) : 0] }));
  const ends = { spawn, heading, exit: lowered.game.mechanics.at(-1).at, exitFrom: `the ${stage.building.use}'s goal room`, beats, planar: false };
  // a quick goal: its mechanics beside the building's own goal (which keeps its route through the doorways)
  if (goal) {
    const own = goal(ends), extra = own.filter((x) => x.kind !== 'reach-exit');
    base = { ...base, level: { ...base.level, ...(extra.length ? { mechanics: extra } : {}), ...(own.some((x) => x.kind === 'reach-exit') ? {} : { exit: false }) } };
  }
  if (!heroRef) return { tool: 'create_sketch', args: { title: name, manifest: base }, ends };
  const controls = `W / S  run · A / D  turn · Space  jump${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const P = playerWorld({ heroRef, id: 'hero', title: name, controls });
  const events = { ...(P.events || {}), ...(mechanics?.inputs?.length ? { inputs: [...(P.events?.inputs ?? []), ...mechanics.inputs] } : {}) };
  const manifest = { ...base, figures: P.figures, entities: [{ ...P.entities[0], transform: { pos: spawn, heading } }], camera: P.camera, events };
  return { tool: 'create_sketch', args: { title: name, manifest }, ends };
}
