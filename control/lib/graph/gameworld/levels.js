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
import { assembleStageScene } from '../era/stage.js';
import { playerWorld } from '../playscape/player.js';
import { resolveEquipment } from './equipment.js';

const EYE_FALLBACK = 1.7;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Every stage of every level, the start level first, then the rest in the world's order. */
export function gameStages(world) {
  const G = readGameworld(world), order = [G.start, ...G.ids.filter((id) => id !== G.start)], out = [];
  for (const level of order) {
    const laid = layLevel(resolveLevel(G, level).level);
    laid.stages.forEach((s, i) => out.push({ level, node: s.node, section: s.section, index: i, manifest: s.manifest }));
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
  let exit = null, exitFrom = null;
  // a trail: the exit beat of its own trail (the pages after the first also carry the trail before it)
  const own = manifest.trail ? `out-trail:${manifest.trail.id}` : null;
  const beat = anchors.find((a) => a.kind === 'beat' && a.beat === 'exit' && (!own || a.trail === own));
  if (beat) { exit = beat.at; exitFrom = 'the trail\'s exit beat'; }
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
  return { spawn, heading, exit, exitFrom, planar: !!beat, beats, hazards };
}

/**
 * The call that makes one stage a game level: `create_sketch` of the stage with the hero as the pilot, the systems'
 * play block and inputs (when the world has systems), and `game: { levelRef, mechanics: [reach-exit], fall }`.
 * `mechanics` is resolveMechanics' result (or null); `ref` the level's own sketch ref (its levelRef).
 */
export function stageLevelOrder(G, stage, { ref, heroRef, mechanics = null, title, goal } = {}) {
  const ends = stageEnds(stage.manifest);
  const name = title ?? `${G.name ?? G.id} · ${stage.level} · ${stage.node}`;
  const controls = `W / S  ${heroRef ? 'run' : 'walk'} · A / D  turn${heroRef ? ' · Space  jump' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const game = { levelRef: ref, mechanics: goal ? goal(ends) : [{ kind: 'reach-exit', at: ends.exit, radius: 2.5, ...(ends.planar ? {} : { planar: false }) }], fall: { mode: 'respawn' } };
  let pilotPart;
  if (heroRef) {
    const P = playerWorld({ heroRef, id: 'hero', title: name, controls });
    const events = { ...(P.events || {}), ...(mechanics?.inputs?.length ? { inputs: [...(P.events?.inputs ?? []), ...mechanics.inputs] } : {}) };
    pilotPart = { figures: P.figures, entities: [{ ...P.entities[0], transform: { pos: ends.spawn, heading: ends.heading } }], camera: P.camera, events };
  } else {
    // FIRST PERSON: no hero; you are the camera, a walker held at the stage's own eye height
    const P = playerWorld({ heroRef: 'none', id: 'player', title: name, controls });   // for its legend only: no figure is kept
    pilotPart = {
      entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: 4.5, turn: 2.4, eye: EYE_FALLBACK }, body: { type: 'none' }, transform: { pos: [ends.spawn[0], ends.spawn[1], ends.spawn[2] + EYE_FALLBACK], heading: ends.heading } }],
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
  return stages.map((s, i) => ({ ref: refs[i], title: `${s.level} · ${s.node}`, ...(i > 0 ? { gate: { completed: refs[i - 1] } } : {}) }));
}
