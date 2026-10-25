/**
 * THE LEVELS MADE PLAYABLE — each stage of a gameworld's levels as a world the hero pilots. A level is laid as one walk
 * of stages (level/sequential.js), and a stage is already a walkable world kind (`stage`, era/stage.js): its ground,
 * its colliders, its first-person spawn, the beats of its trail or the tiers of its climb. This puts the hero on it as
 * the pilot (playscape/player.js, without the player test's floor), spawned where the stage spawns a walker, facing the
 * way out, with the systems' play block (the stats, the HUD, the powers on their keys) and the game's destruction degree,
 * and a `game` channel whose exit is the stage's own end: a trail's exit beat, a climb's top tier. One game level per
 * stage, in walking order; a level's stages are not joined into one world.
 *
 * WALKABLE, NOT BEATABLE. What a stage's construction gives is ground the hero stands on from the spawn; whether a level
 * can be beaten (the moves, the numbers, the obstacles, the timing) is the creator's to judge in play. Nothing here
 * claims it.
 *
 *   gameStages(G)                          → [{ level, node, section, index, manifest }] every stage, the start level first
 *   stageEnds(manifest)                    → { spawn, heading, exit, exitFrom } read off the laid stage
 *   roadwayEnds(manifest)                  → the same, read off a roadway's contract (roads/contract.js)
 *   airspaceEnds(manifest)                 → the same, read off an airspace's map and course (skyscape/)
 *   stageLevelOrder(G, stage, { ref, heroRef, pilot?, mechanics, title, goal?, goalCast? }) → the create_sketch call
 *                               that makes it (`pilot` a mascot hero's measures, egocube/mascot-pilot.js; `goal` and
 *                               `goalCast` a goal's mechanics and what it stands, on a trail or in a building's rooms)
 *   gameStore(G, book)                     → the create_game store: the hero, the gear, the campaign
 *
 * Pure (the stage is assembled to read its ends; nothing is stored).
 */
import { readGameworld, resolveLevel, looksOfKit } from './world.js';
import { rollArt, ART_KITS, ART_ITEMS } from '../era/art-direction.js';
import { solvePalette, fingerprint as printOf } from '../color-theorist/solve.js';
import { artPalette, natureColours } from '../color-theorist/adapters.js';
import { layLevel } from '../level/index.js';
import { assembleStageScene, planStage, stageKit } from '../era/stage.js';
import { withGeocube } from '../era/geocube.js';
import { playerWorld, traversalStates } from '../playscape/player.js';
import { resolveEquipment } from './equipment.js';
import { outTrailOf } from '../era/out-trail-board.js';
import { TRAVERSAL_MOVES, HERO_MOVES } from './actions.js';
import { RIDE_H } from './ride.js';
import { fixedStations, uprightCamera } from './cameras.js';
import { readScreen } from '../game/screen.js';
import { cubeOfWorld } from './intent.js';
import { concernIds } from './concerns.js';
import { SPACING, beatPosts, coverBlocks, blindBlocks, concernLaws, jumpHeight, raisePickups, loopOn, loopBlocks, arenaOn, arenaLayout } from './lay-concerns.js';
import { sceneFlags, sceneNeeds } from '../playscape/ui/scenes.js';
import { storyScene, levelQuests } from './story.js';
import { withBuildingLevel, PROBE } from '../structure/level.js';
import { withProgram } from '../era/programs.js';
import { buildNav } from '../worlds/controllable/nav.js';
import { inferCity } from '../city/plan/card.js';
import { designCity } from '../city/plan/design.js';
import { CITY_HERO } from '../city/plan/level.js';
import { planTrack, trackCensus, trackLaws } from '../roads/track.js';
import { planScapedTrack } from '../roads/trackscape-dress.js';
import { trackContract, trackSurface } from '../roads/contract.js';
import { airspaceOf } from '../skyscape/airspace.js';
import { planCourse } from '../skyscape/course.js';
import { mapLaws } from '../skyscape/map.js';
import { spaceLaws } from '../skyscape/space.js';
import { flyCourse } from '../skyscape/autopilot.js';
import { seatCraft, craftPilot } from '../skyscape/craft.js';
import { battleRoster, laidBattles, PARTY_SLICE, BAG_SLICE, BAG_START } from './battles.js';
import { mergeExtras, libraryFigure, fieldFigure, stand, PERSON_BODY } from './stage-figures.js';
import { feelCard, lowerFeel } from './feel/lower.js';
import { juiceOfGame } from './juice.js';

// the world's juice (juice.js): its effects' floor, composed from its register and its game type, on every level; none
// written, nothing laid
const juiceOf = (G) => { const J = juiceOfGame(G); return J ? { fxStyle: J.fxStyle } : {}; };

const EYE_FALLBACK = 1.7;
// a person's eye over a hero whose position is its feet (playerWorld's pilot stands at eye 0)
const HERO_EYE = 1.6;
// the ¾ overhead camera: north up the screen, 60° below the horizon, far enough back to read a trail's next turn
// the flags slice a world's breaks are kept in (the aftermath mechanic)
export const AFTERMATH_SLICE = 'aftermath';
const OVERHEAD = Object.freeze({ yaw: Math.PI / 2, tilt: Math.PI / 3, dist: 14, lookH: 1 });
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Every stage of every level, the start level first, then the rest in the world's order. */
export function gameStages(world) {
  const G = readGameworld(world), order = [G.start, ...G.ids.filter((id) => id !== G.start)], out = [];
  for (const level of order) {
    const R = resolveLevel(G, level);
    // a building level is one stage: its rooms laid from its program (or the building already made, by ref)
    if (R.building) { out.push({ level, node: 'building', section: 'building', index: 0, building: R.building, manifest: R.building.ref ? null : inPalette(buildingStage(R.building), R.style?.palette ?? G.style?.palette, `${level}/building`) }); continue; }
    // a city level is its segments: a line of them from its way in to its way out in a linear world, all of them in a map
    if (R.city) { out.push(...cityStages(level, R.city, G.topology === 'interconnected')); continue; }
    // a runner level is one stage: the run (worlds/controllable/runner.js), its ground a floor, its rows laid in play
    if (R.runner) { out.push({ level, node: 'runner', section: 'runner', index: 0, manifest: runnerStage(R.runner) }); continue; }
    // a roadway level is one stage: the track (roads/track.js), its manifest the roadway kind's
    if (R.roadway) { out.push({ level, node: 'roadway', section: 'roadway', index: 0, manifest: { kind: 'roadway', ...R.roadway, seed: R.seed } }); continue; }
    // an airspace level is one stage: the flight map (skyscape/airspace.js), its manifest the airspace kind's
    // manifest, coloured by the level's palette (the world's, or the world's moved by its script) where it has one
    if (R.airspace) { const pal = R.style?.palette ?? G.style?.palette; out.push({ level, node: 'airspace', section: 'airspace', index: 0, manifest: { kind: 'airspace', ...R.airspace, seed: R.seed, ...(pal ? { palette: pal } : {}) } }); continue; }
    const laid = layLevel(R.level);
    // the level's buildings stand on the section they name, or on its first trail
    const home = (b) => b.node ?? laid.stages.find((s) => s.section === 'trail')?.node;
    laid.stages.forEach((s, i) => {
      const here = (R.buildings ?? []).filter((b) => home(b) === s.node).map(({ node: _n, ...b }) => b);
      // the town's street stands on the first trail
      const street = R.street && s.node === laid.stages.find((x) => x.section === 'trail')?.node ? { ...R.street, seed: R.seed } : null;
      // the field its intent laid (lay-concerns.js), on the first trail it was flattened on
      const first = s.node === laid.stages.find((x) => x.section === 'trail')?.node;
      // a loop's track: nothing grows on it (era/reserve.js)
      const keep = (R.loop || R.arena) && first ? { _keepOut: [...(R.loop?.keep ?? []), ...(R.arena?.keep ?? [])] } : {};
      // a stage drawn in a composed look carries the recipes that compose its kit (the look registry is the process's own)
      const looks = s.manifest?.kit ? looksOfKit(s.manifest.kit) : null;
      // a stage on a nature or jungle kit in a palette world carries the palette as its builder reads it
      const painted = paintedPalette(s.manifest, R.style?.palette ?? G.style?.palette);
      const manifest = here.length || street || keep._keepOut || looks || painted ? { ...s.manifest, ...(here.length ? { buildings: here } : {}), ...(street ? { town: street } : {}), ...keep, ...(looks ? { looks } : {}), ...(painted ? { palette: painted } : {}) } : s.manifest;
      const field = { ...(R.field && first ? { field: R.field } : {}), ...(R.board && first ? { board: R.board } : {}), ...(R.loop && first ? { loop: R.loop } : {}), ...(R.arena && first ? { arena: R.arena } : {}) };
      out.push({ level, node: s.node, section: s.section, index: i, manifest, ...field });
    });
    // the insides of the buildings whose scene changes at the door: each a level of its own, after the level's stages,
    // linked by its door (the outside's `door` ↔ the inside's `out`)
    let k = laid.stages.length;
    for (const st of out.filter((x) => x.level === level && (x.manifest?.buildings || x.manifest?.town))) {
      for (const d of stageEnds(st.manifest).doors ?? []) {
        out.push({ level, node: `${st.node}-${d.id}`, section: 'interior', index: k++, outside: { node: st.node, index: st.index, door: d.id }, building: { use: d.inside.use }, manifest: inPalette(interiorStage(d.inside), R.style?.palette ?? G.style?.palette, `${level}/${st.node}-${d.id}`) });
      }
    }
  }
  return out;
}

/**
 * A city level's stages: its plan laid (and cut into segments), entered at `from` (the segment holding the core, by
 * default) and left from `to` (the segment the most portals away, by default). In a line of levels, the segments along
 * the fewest portals between them, each opening only toward the one before and the one after; in a map, every segment,
 * the way in first and the way out last, each joined to its neighbours at their portals. Each stage's manifest is the
 * whole plan with its `level` (city/plan/level.js lowers it on every read).
 */
export function cityStages(level, C, map = false) {
  let recipe;
  try { recipe = inferCity({ ...C.plan, segments: C.plan.segments ?? true }).recipe; } catch (e) { throw new Error(`gameworld: levels.${level}.${e.message}`); }
  const d = designCity(recipe), segs = d.segments ?? [];
  const byId = new Map(segs.map((x) => [x.id, x])), name = (k) => `levels.${level}.city.${k}`;
  for (const k of ['from', 'to']) if (C[k] !== undefined && !byId.has(C[k])) throw new Error(`gameworld: ${name(k)} '${C[k]}' is not one of the city's segments (${segs.map((x) => x.id).join(', ')})`);
  const core = segs.find((x) => d.field.cx >= x.rect.x0 && d.field.cx < x.rect.x1 && d.field.cy >= x.rect.y0 && d.field.cy < x.rect.y1) ?? segs[0];
  const from = C.from ?? core.id;
  // the fewest portals from the way in to every segment
  const hops = new Map([[from, 0]]), prev = new Map(), queue = [from];
  while (queue.length) { const a = queue.shift(); for (const nb of byId.get(a).neighbours) if (!hops.has(nb.id)) { hops.set(nb.id, hops.get(a) + 1); prev.set(nb.id, a); queue.push(nb.id); } }
  const to = C.to ?? [...hops.keys()].reduce((b, id) => (hops.get(id) > hops.get(b) ? id : b), from);
  if (!hops.has(to)) throw new Error(`gameworld: ${name('to')} '${to}' cannot be reached from '${from}' through the city's portals`);
  const stage = (segment, i, lv) => ({ level, node: segment, section: 'city', index: i, city: { segment, neighbours: byId.get(segment).neighbours.map((n) => n.id), ...(C.stalker ? { stalker: true } : {}) }, manifest: { kind: 'city', ...recipe, level: { segment, ...lv } } });
  if (map) {
    const order = [from, ...segs.map((x) => x.id).filter((id) => id !== from && id !== to && hops.has(id)), ...(to !== from ? [to] : [])];
    return order.map((id, i) => stage(id, i, {}));
  }
  const path = [to]; while (path[0] !== from) path.unshift(prev.get(path[0]));
  return path.map((id, i) => stage(id, i, { route: { ...(i > 0 ? { from: path[i - 1] } : {}), ...(i + 1 < path.length ? { to: path[i + 1] } : {}) } }));
}

/** The moves the world's hero starts with (characters.hero.actions.moves, actions.js HERO_MOVES): the patch they make
 *  to its platform rule (null with none), and its player made over it: the rule, the traversal states' clips
 *  (player.js traversalStates: the wall's and the line's states play a clip every figure has), F named on the legend. */
function heroMoves(G) {
  const ids = G.characters?.hero?.actions?.moves ?? [];
  return ids.length ? Object.assign({}, ...ids.map((id) => HERO_MOVES[id].rule)) : null;
}
function withMoves(P, moves) {
  if (!moves) return P;
  const figures = Object.fromEntries(Object.entries(P.figures || {}).map(([k, f]) => [k, { ...f, ...(f.clips ? { clips: traversalStates(f.clips) } : {}) }]));
  return { ...P, figures, entities: P.entities.map((e, i) => (i === 0 ? { ...e, rule: { ...e.rule, ...moves } } : e)) };
}
const movesLegend = (moves) => (moves && moves.gear ? ' · F  swing (in the air), zip (on the ground)' : '');

/** A city segment's create_sketch call: its manifest with the levels of its neighbours by ref, and in a map the world's
 *  ways out of the city (`map`: mapPlan's for this stage) at its start (back) or its farthest crossing (on). The
 *  segment's own first-person walker plays it: a city is in its own units, not the hero's metres. A stalker's city
 *  (`city.stalker`) is played by the world's hero instead (`level.hero`), turned into the city's units where it is
 *  lowered (city/plan/level.js); with no hero, a stand-in. */
function cityLevelOrder(G, stage, { title, map = null, cityRefs = {}, heroRef = null, heroGaits = null } = {}) {
  const name = title ?? `${G.name ?? G.id} · ${stage.level} · ${stage.node}`;
  // a map world's keys laid here go on the segment's tallest roof the hero reaches (city/plan/level.js cityFound); its
  // power keys' moves ride as grants in metres, turned into the city's units where it is lowered
  const found = map ? [...(map.keys ?? []).map((item) => ({ item, into: 'bag' })), ...(map.powers ?? []).map((item) => ({ item, into: 'powers' }))] : [];
  const pk = map ? powerKeys(G) : [];
  const powers = pk.length ? Object.fromEntries(pk.filter((p) => p.move).map((p) => [p.id, TRAVERSAL_MOVES[p.move].rule({ jumpSpeed: CITY_HERO.rule.jumpSpeed })])) : null;
  const ways = map ? [...map.on.map((w) => ({ id: w.id, to: w.to, at: 'end', ...(w.gate ? { gate: w.gate } : {}) })), ...map.back.map((w) => ({ id: w.id, to: w.to, at: 'start' }))] : [];
  const refs = Object.fromEntries(Object.entries(cityRefs).filter(([id]) => id !== stage.node));
  const hero = stage.city.stalker ? { hero: { ...(heroRef ? { ref: heroRef } : {}), ...(heroRef && heroGaits ? { gaits: heroGaits } : {}) } } : {};
  const manifest = { ...stage.manifest, title: name, level: { ...stage.manifest.level, ...(Object.keys(refs).length ? { refs } : {}), ...(ways.length ? { ways } : {}), ...hero, ...(found.length ? { found } : {}), ...(powers ? { powers } : {}) } };
  return { tool: 'create_sketch', args: { title: name, manifest } };
}

/** An airspace stage's anchors, read off its map and its course (skyscape/): the first pad's threshold to start on,
 * looking down it, the course's finish (the runway's touchdown zone) to end at. Not data: the map, the ground, the
 * course and the laws (the map's and the course's) ride along for the pilot and the goal (as airMap, airField, course and
 * airLaws: a stage's `field` is its flattened ground, set per call). Drawn once per manifest. */
const AIR_ENDS = new Map();
export function airspaceEnds(manifest) {
  const key = JSON.stringify(manifest);
  if (AIR_ENDS.has(key)) return AIR_ENDS.get(key);
  if (AIR_ENDS.size > 8) AIR_ENDS.clear();
  let map, field;
  try { ({ map, field } = airspaceOf(manifest)); } catch (e) { throw new Error(`levels: ${e.message}`); }
  const course = manifest.course ? planCourse(map, field, { ...(manifest.course === true ? {} : manifest.course), seed: manifest.seed ?? 1 }) : null;
  const F = map.rings.field, seat = seatCraft(map, field, course, { assist: manifest.assist }), [sx, sy] = seat.transform.pos;
  const exit = field.port ?? course?.finish?.at ?? course?.gates.at(-1).at ?? [0, F.hy, field.groundAt(0, F.hy)];
  const out = { spawn: [sx, sy, seat.ground], heading: seat.transform.heading, exit, exitFrom: course?.finish ? 'the runway' : 'the last gate', planar: false, beats: [], hazards: [] };
  // and the course flown by its own craft (skyscape/autopilot.js): the flight's walkability, a machine gate
  // (a trench run's proof is its line: down the middle, waypoints a little narrower than the trench, trench.js)
  const run = course ?? (field.line?.length ? { gates: field.line.map((at) => ({ at, radius: field.trench.w / 2 - 5 })), laps: 1, finish: null } : null);
  const flown = run ? flyCourse(map, field, run, { rule: seat.rule }) : null;
  // a space map's own laws (space.js: turn room in three dimensions, the rocks clear of the course)
  const laws = [...(map.form === 'void' ? spaceLaws(map, field, course, seat.transform) : mapLaws(map)), ...(course ? course.laws : []), ...(flown ? [{ law: 'flown', ok: flown.flown, note: flown.flown ? `flown by its own craft on its rule: every ${field.port ? 'waypoint down the trench' : 'gate'} in order${flown.landing ? `, then landed on the runway at ${flown.landing.sink} m/s and stopped` : ''}, in ${flown.time} s` : `not flown by its own craft: ${flown.reason}` }] : [])]
    .map((l) => ({ concern: 'airspace', law: l.law, holds: l.ok, says: l.note }));
  for (const [k, v] of Object.entries({ ground: (x, y) => field.groundAt(x, y), rocks: null, airMap: map, airField: field, course, seat, airLaws: laws })) Object.defineProperty(out, k, { value: v, enumerable: false });
  AIR_ENDS.set(key, out);
  return out;
}

/** A roadway stage's anchors, read off its contract (roads/contract.js): the pole of its grid to start on, facing the
 * way on, its finish line to end at; its surface (the car's ground), its barriers (colliders), the contract itself and
 * the track's laws (not data: a reader of the ends never sees them). Drawn once per manifest, as a stage's are. */
const ROAD_ENDS = new Map();
export function roadwayEnds(manifest) {
  const key = JSON.stringify(manifest);
  if (ROAD_ENDS.has(key)) return ROAD_ENDS.get(key);
  if (ROAD_ENDS.size > 16) ROAD_ENDS.clear();
  let plan;
  try { plan = manifest.scape ? planScapedTrack(manifest) : planTrack(manifest); } catch (e) { throw new Error(`levels: ${e.message}`); }
  const T = trackContract(plan), surface = trackSurface(plan), pole = T.grid[0];
  const out = { spawn: pole.at, heading: pole.heading, exit: T.finish.at, exitFrom: 'the finish line', planar: true, beats: [], hazards: [] };
  const at = (x, y) => surface([x, y, 1e4]);
  for (const [k, v] of Object.entries({ ground: at, surface: at, rocks: null, colliders: plan.colliders, roadway: T, roadLaws: trackLaws(trackCensus(plan)) })) Object.defineProperty(out, k, { value: v, enumerable: false });
  ROAD_ENDS.set(key, out);
  return out;
}

/** A runner level's stage: the run alone (its lanes, posts and rows drawn by its page as it is played), on a floor the
 * whole way, in a sky; started at the origin facing +x. */
export const RUNNER_FLOOR = Object.freeze({ min: [-100000, -100000, -2], max: [100000, 100000, 0] });
function runnerStage(runner) {
  return { kind: 'controllable', title: 'run', bg: '#9cc4e4', faces: [], colliders: [RUNNER_FLOOR], runner, worldFraming: { cameraPosition: [-8, 0, 4], lookAt: [12, 0, 1], horizontalFov: 70 } };
}
/** A runner stage's anchors: the start, facing down the run, and an end it never reaches (its rows end it). */
export function runnerEnds() {
  const out = { spawn: [0, 0, 0], heading: 0, exit: [100000, 0, 0], exitFrom: 'the end of the run', planar: true, beats: [], hazards: [] };
  for (const [k, v] of Object.entries({ ground: () => 0, rocks: null, colliders: [RUNNER_FLOOR] })) Object.defineProperty(out, k, { value: v, enumerable: false });
  return out;
}
// a runner's chase camera: behind and above, looking well ahead (the rows come fast)
export const RUNNER_CAMERA = Object.freeze({ dist: 6, height: 3, lead: 8, lookH: 1.2 });

/** Where a stage spawns the hero and where it ends, read off the stage as it lays (drawn once per stage recipe: a
 * stage is pure, so the same recipe always ends the same). The memo keeps the last ENDS_KEPT stages (about 8 MB each,
 * its land's corners): enough for a world's run to read each stage once, bounded for a server that makes many. */
const ENDS = new Map(), ENDS_KEPT = 16;
export function stageEnds(manifest) {
  const key = JSON.stringify(manifest);
  if (!ENDS.has(key)) { if (ENDS.size >= ENDS_KEPT) ENDS.delete(ENDS.keys().next().value); ENDS.set(key, readEnds(manifest)); }
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
  const out = { spawn, heading, exit, exitFrom, planar: !!beat && !holds, beats, hazards, ...(via ? { via } : {}), ...(doors.length ? { doors } : {}), ...(storeyed ? { storeyed } : {}) };
  // the land's height at a point (its top and ground faces, the highest there), for a goal laying things on it (a
  // puzzle's grid); not data: a reader of the ends never sees it
  Object.defineProperty(out, 'ground', { value: groundSampler(P.faces ?? []), enumerable: false });
  // the land with its walk (a kit whose trail is its own surface, not laid on the ground): what a vehicle drives on
  Object.defineProperty(out, 'surface', { value: groundSampler(P.faces ?? [], /:(top|ground|trail)$/), enumerable: false });
  // the rocks' tops over the land (a landmark, scree): what a wheel would climb
  Object.defineProperty(out, 'rocks', { value: groundSampler(P.faces ?? [], /:rock$/), enumerable: false });
  // what stands solid on it (boxes), for a law to keep a track clear; not data either
  Object.defineProperty(out, 'colliders', { value: P.colliders ?? [], enumerable: false });
  return out;
}

// the stage's land as a height lookup: its walkable top faces bucketed by a 2 m grid, a point's height the highest face
// over it (two triangles a quad), or null off the land. It keeps only the matching faces' corners, never the stage's
// whole face list: a stage's ends are memoised, and the list is tens of MB.
function groundSampler(faces, groups = /:(top|ground)$/) {
  const kept = faces.filter((f) => groups.test(f.group || '') && Array.isArray(f.corners) && f.corners.length >= 3).map((f) => f.corners);
  let grid = null;
  const build = () => {
    grid = new Map();
    for (const corners of kept) {
      const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
      for (let gx = Math.floor(Math.min(...xs) / 2); gx <= Math.floor(Math.max(...xs) / 2); gx++) for (let gy = Math.floor(Math.min(...ys) / 2); gy <= Math.floor(Math.max(...ys) / 2); gy++) {
        const k = `${gx},${gy}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(corners);
      }
    }
  };
  const tri = (a, b, c, x, y) => {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-12) return null;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, w = 1 - u - v;
    return u >= -1e-9 && v >= -1e-9 && w >= -1e-9 ? u * a[2] + v * b[2] + w * c[2] : null;
  };
  return (x, y) => {
    if (!grid) build();
    let best = null;
    for (const c of grid.get(`${Math.floor(x / 2)},${Math.floor(y / 2)}`) ?? []) {
      for (let k = 1; k + 1 < c.length; k++) { const z = tri(c[0], c[k], c[k + 1], x, y); if (z != null && (best == null || z > best)) best = z; }
    }
    return best == null ? null : r3(best);
  };
}

// a racer's chase camera: close and low behind a kart-sized machine
export const RACER_CAMERA = Object.freeze({ dist: 5.2, height: 2, lead: 1.5, lookH: 0.5 });
// a supercar's chase: low and close behind, the road ahead filling the frame (a car's length and a half back)
export const SUPERCAR_CAMERA = Object.freeze({ dist: 8.5, height: 2.7, lead: 5, lookH: 0.9 });

/**
 * The call that makes one stage a game level: `create_sketch` of the stage with the hero as the pilot, the systems'
 * play block and inputs (when the world has systems), and `game: { levelRef, mechanics: [reach-exit], fall }`.
 * `mechanics` is resolveMechanics' result (or null); `ref` the level's own sketch ref (its levelRef).
 */
/**
 * (`moves`: { <ref>: states } the figures a run made with their own reactions, by the made ref they stand for (the
 * world's `moves`): each figure of the level standing for one, the pilot's included, plays them over the library's.)
 */
export function stageLevelOrder(G, stage, opts = {}) {
  const laid = levelOrder(G, stage, opts);
  const L = opts.moves ? withOwnMoves(laid, opts.moves) : laid;
  // the screen the game is made for (game/screen.js): each level holds its frame. Absent: no key, every print as it was
  return G.screen ? screenLevel(G.screen, L) : L;
}
function withOwnMoves(L, byRef) {
  const m = L.args?.manifest;
  if (!m?.figures) return L;
  let changed = false;
  const figures = Object.fromEntries(Object.entries(m.figures).map(([id, f]) => {
    const st = f && !f.moves && f.heroRef ? byRef[f.heroRef] : null;
    if (!st) return [id, f];
    changed = true;
    return [id, { ...f, moves: st }];
  }));
  return changed ? { ...L, args: { ...L.args, manifest: { ...m, figures } } } : L;
}

/** A level order framed for its screen: the screen on its manifest; an UPRIGHT frame's camera from the table
 * (cameras.js uprightCamera: its width fov, a chase pulled back with its look raised), the creator's own fov winning;
 * a side camera across an upright frame advised (a law that does not hold: advice, never a refusal). */
function screenLevel(written, L) {
  const S = readScreen(written), m = L.args.manifest;
  if (S.orientation !== 'portrait') return { ...L, args: { ...L.args, manifest: { ...m, screen: written } } };
  const U = uprightCamera(m.camera ?? null);
  const screen = { ...(typeof written === 'string' ? { pole: written } : written), fov: S.fov ?? U.fov };
  const manifest = { ...m, ...(U.camera ? { camera: U.camera } : {}), screen };
  const advice = U.lane !== undefined ? [{ concern: 'screen', law: 'frame-fits', holds: false, says: `a side camera across an upright ${S.pole === 'custom' ? 'frame' : S.pole} sees about ${U.lane} m of its lane (about ${U.laneWide} m on a monitor): a side-scroller reads better on a tablet or a screen` }] : [];
  return { ...L, args: { ...L.args, manifest }, ...(advice.length ? { laws: [...(L.laws ?? []), ...advice] } : {}) };
}

function levelOrder(G, stage, { ref, heroRef, heroGaits = null, pilot = null, mechanics = null, title, goal, map = null, story = null, carryFrom = null, party = null, castFigures = null, guards = null, audio = null, ride = null, extra = null, legend = null, goalCast = null, cityRefs = {} } = {}) {
  // a building level, or the inside of a building entered by its door: laid from its program (buildingLevelOrder)
  if (stage.section === 'city') return cityLevelOrder(G, stage, { title, map, cityRefs, heroRef, heroGaits });
  if (stage.section === 'building' || stage.section === 'interior') return buildingLevelOrder(G, stage, { ref, heroRef, heroGaits, pilot, mechanics, title, goal: stage.section === 'interior' ? null : goal, goalCast: stage.section === 'interior' ? null : goalCast, extra, story, carryFrom, party, castFigures });
  const ends = stage.section === 'roadway' ? roadwayEnds(stage.manifest) : stage.section === 'airspace' ? airspaceEnds(stage.manifest) : stage.section === 'runner' ? runnerEnds() : stageEnds(stage.manifest);
  // what game it is (intent.js): the stage's share of its concerns (lay-concerns.js), on its anchors before any goal
  // reads them: the field the ground was flattened for, a race's checkpoint spacing; cover stands after the goal's cast
  const concerns = concernIds(cubeOfWorld(G).cube);
  // (set on every call, null when absent: a stage's anchors may be a cached object another stage read before)
  Object.defineProperty(ends, 'field', { value: stage.field ?? null, enumerable: false, configurable: true });
  Object.defineProperty(ends, 'board', { value: stage.board ?? null, enumerable: false, configurable: true });
  Object.defineProperty(ends, 'spacing', { value: concerns.includes('circuit') ? SPACING : null, enumerable: false, configurable: true });
  Object.defineProperty(ends, 'loop', { value: stage.loop ? loopOn(stage.loop, ends) : null, enumerable: false, configurable: true });
  // the arena (the intent's `arena` concern): its square on the land, laid from its plan (tunnel-arena.js) with its
  // walls, cover, spawns and supplies, before the goal reads them
  Object.defineProperty(ends, 'arena', { value: stage.arena ? (() => { const A = arenaOn(stage.arena, ends); return { ...A, ...arenaLayout(A) }; })() : null, enumerable: false, configurable: true });
  const name = title ?? `${G.name ?? G.id} · ${stage.level} · ${stage.node}`;
  // the camera (the gameworld's `camera`, cosmos space.camera). Absent keeps every arg below as it was, so the steps'
  // fingerprints hold: third person with a hero, the old first-person walker without one.
  const cam = G.camera ?? null;
  if (cam === 'top-down' && !heroRef) throw new Error('levels: a top-down camera watches a hero; give the world a hero (quick.hero, or its characters), or play it first-person');
  if (cam === 'side' && !heroRef) throw new Error('levels: a side camera watches a hero run its lane; give the world a hero, or play it first-person');
  if (cam === 'third-person' && !heroRef) throw new Error('levels: a third-person camera follows a hero; give the world a hero, or play it first-person');
  if (cam === 'fixed' && !heroRef) throw new Error('levels: fixed cameras watch a hero walk past them; give the world a hero, or play it first-person');
  const look = cam === 'first-person', top = cam === 'top-down', lane = cam === 'side' ? stageLane(stage) : null;
  const moveWords = stage.section === 'runner' ? 'A / D  change lane · S  slide' : lane ? 'A / D  run' : top ? 'W A S D  move' : look ? `W / S  ${heroRef ? 'run' : 'walk'} · A / D  step aside · mouse  look` : `W / S  ${heroRef ? 'run' : 'walk'} · A / D  turn`;
  const controls = `${moveWords}${heroRef ? ' · Space  jump' : ''}${legend ? ` · ${legend}` : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  // (a runner's own goal is the run: a crash ends it, the score its result)
  const placed0 = goal ? goal(ends) : stage.section === 'runner' ? [{ kind: 'runner' }] : [{ kind: 'reach-exit', at: ends.exit, radius: 2.5, ...(ends.planar ? {} : { planar: false }), ...(ends.via ? { via: ends.via } : {}) }];
  // the doors of its buildings whose scene changes there (stage-buildings.js): each a `door` mechanic, its inside a level
  const doorMechs = (ends.doors ?? []).map(({ inside: _i, ...d }) => ({ kind: 'door', ...d }));
  // a MAP world: the stage's one exit becomes its ways out (each a named reach-exit), and its arrivals move the pilot
  const ways = map ? stageWays(stage, ends, map) : null;
  const placed = ways ? [...placed0.filter((m) => m.kind !== 'reach-exit'), ...ways.mechanics] : placed0;
  // what the game lets break stays broken (the aftermath mechanic: the breaks kept in the world's aftermath slice)
  const after = mechanics?.destruction && mechanics.destruction !== 'none' ? [{ kind: 'aftermath', slice: AFTERMATH_SLICE }] : [];
  const game = { levelRef: ref, mechanics: [...doorMechs, ...(lane ? placed.map((m) => onLane(m, lane)) : placed), ...after], fall: { mode: 'respawn' }, ...(ways && ways.arrive.length ? { arrive: ways.arrive.map((a) => a.from) } : {}) };
  let pilotPart, seatable = false;
  if (stage.section === 'airspace') {
    // THE CRAFT (skyscape/craft.js): an airspace is flown, whoever the hero is: the map's craft on the fly rule its class
    // gives, the map's reach its bound, seated on the departure threshold (a craft with no engine launched aloft, high
    // enough to glide to the first gate), followed from behind by a chase camera that banks with it
    const aloft = ends.seat.rule.engine === false;
    const P = playerWorld({ heroRef: 'none', id: 'player', title: name, controls: `${aloft ? '' : 'W / S  throttle (it holds) · '}A / D  bank · Space / Shift  nose up / down · mouse  pitch${ride?.transformer ? ' · B  transform' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}` });
    pilotPart = { ...craftPilot(ends.airMap, ends.seat), events: P.events || {} };
    if (ride?.transformer) {
      // A FLIER THAT TRANSFORMS (quick.transformer): seated as the craft is, in its vehicle form on the seat's rule, its
      // body the transformer; B drops it into its robot form (it falls, lands, walks) and back into the air
      const e0 = pilotPart.entities[0], { rule, ambient, body, ...seat } = e0;
      const { rule: _c, target: _t, ...chase } = pilotPart.camera;
      pilotPart = {
        ...pilotPart,
        figures: { ride: { transformer: ride.transformer } },
        entities: [{ ...seat, ambient, form: 'vehicle', forms: { vehicle: { rule, camera: chase }, robot: ride.forms.robot }, transformDur: 0.8, body: { type: 'figure-rig', figure: 'ride' } }],
      };
    }
  } else if (ride?.transformer) {
    // A HERO THAT TRANSFORMS (quick.transformer): a robot that runs and jumps and a car it folds into (B), one body
    // (transformation/), followed from behind at each form's own stand-off
    const P = playerWorld({ heroRef: 'none', id: 'hero', title: name, controls: `W / S  run · A / D  turn · Space  jump · B  transform (then W  throttle · S  brake)${mechanics?.legend ? ` · ${mechanics.legend}` : ''}` });
    pilotPart = {
      figures: { ride: { transformer: ride.transformer } },
      entities: [{ id: 'hero', pilotable: true, forms: ride.forms, transformDur: 0.8, body: { type: 'figure-rig', figure: 'ride' }, transform: { pos: ends.spawn, heading: ends.heading } }],
      camera: { rule: 'follow', target: 'hero', ...ride.forms.robot.camera },
      events: P.events || {},
    };
  } else if (ride?.ref || ride?.racer || ride?.figure) {
    // THE RIDE (ride.js): the hero is a vehicle, on the drive rule its build derived, followed from behind; or a racer
    // (quick.racers): the first of the field, in the machine its driver reads as, followed close (a kart is small)
    const P = playerWorld({ heroRef: 'none', id: 'car', title: name, controls: `W  throttle · S  brake, hold to reverse · A / D  steer${mechanics?.legend ? ` · ${mechanics.legend}` : ''}` });
    pilotPart = {
      figures: { ride: ride.figure ?? (ride.racer ? { racer: ride.racer } : { vehicleRef: ride.ref, targetH: RIDE_H }) },
      entities: [{ id: 'car', pilotable: true, rule: ride.rule, body: { type: 'figure-rig', figure: 'ride' }, transform: { pos: ends.spawn, heading: ends.heading } }],
      camera: ride.racer ? { rule: 'follow', target: 'car', ...RACER_CAMERA } : ride.figure ? { rule: 'follow', target: 'car', ...SUPERCAR_CAMERA } : { rule: 'follow', target: 'car', dist: 11, height: 4.5, lead: 5, lookH: 1.2 },
      events: P.events || {},
    };
  } else if (heroRef) {
    // first person rides the hero's eye in look mode, its body hidden; top-down moves it in the screen's frame
    const camRule = look ? { turnMode: 'look' } : top ? { move: 'world', moveYaw: OVERHEAD.yaw } : lane ? { move: 'lane', lane: lane.line } : undefined;
    // the world's feel (feel/lower.js): its template's card lowered over the hero's platform rule, the camera's way of
    // moving kept; no feel, the hero's own rule as it was
    const feelRule = G.feel ? lowerFeel(feelCard(G.feel)).rule : null;
    const rule = feelRule ? { ...feelRule, ...(camRule ?? {}) } : camRule;
    // (a mascot pilot, egocube/mascot-pilot.js: its own clips, capsule, stride, camera and eye)
    const moves = heroMoves(G);
    const P = withMoves(playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), id: 'hero', title: name, controls: `${controls}${movesLegend(moves)}`, ...(rule ? { rule } : {}) }), moves);
    const events = { ...(P.events || {}), ...(mechanics?.inputs?.length ? { inputs: [...(P.events?.inputs ?? []), ...mechanics.inputs] } : {}) };
    const camera = look ? { rule: 'eye', target: 'hero', height: pilot ? pilot.eye : HERO_EYE, mouseLook: true, hideTarget: true }
      : top ? { rule: 'overhead', target: 'hero', ...OVERHEAD }
        : lane ? { rule: 'side', target: 'hero' }
        : cam === 'fixed' ? { rule: 'fixed', target: 'hero', stations: fixedStations(ends) }
        : stage.section === 'runner' ? { rule: 'follow', target: 'hero', ...RUNNER_CAMERA }
        : P.camera;
    pilotPart = { figures: P.figures, entities: [{ ...P.entities[0], transform: { pos: ends.spawn, heading: ends.heading } }], camera, events };
    seatable = !look;
  } else {
    // FIRST PERSON: no hero; you are the camera, a walker held at the stage's own eye height (with a body the walls of
    // the stage's buildings stop, when it has any). Asked for by name, it looks with the mouse (yaw and pitch) through
    // an `eye` camera; unnamed, it keeps the old tank-turn walker.
    const P = playerWorld({ heroRef: 'none', id: 'player', title: name, controls });   // for its legend only: no figure is kept
    // (a building on storeys: it looks for its ground over its feet, so it climbs the treads, never onto the floor above)
    const rule = { type: 'walk', speed: 4.5, turn: 2.4, eye: EYE_FALLBACK, ...(look ? { turnMode: 'look', lookPitch: true, strafe: 1 } : {}), ...(stage.manifest.buildings ? { collideRadius: 0.3 } : {}), ...(ends.storeyed ? { probe: PROBE } : {}) };
    pilotPart = {
      entities: [{ id: 'player', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [ends.spawn[0], ends.spawn[1], ends.spawn[2] + EYE_FALLBACK], heading: ends.heading } }],
      camera: look ? { rule: 'eye', target: 'player', height: 0, mouseLook: true } : { rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2 },
      events: P.events || {},
    };
  }
  // GUARDS (a sneak, quick.js): watchers with sight at their posts, sweeping their gaze (`scan`); a sighting is the bus's
  // `seen`, which the `unseen` mechanic ends the level on. `guards`: { ref (their figure, or a pool cycled), posts(ends) → [{ id, at, heading }] }
  const watchers = guards?.ref ? guards.posts(ends) : null;
  if (guards?.ref) {
    const figures = { ...(pilotPart.figures ?? {}) }, entities = [...pilotPart.entities];
    for (const [k, g] of watchers.entries()) {
      // (a pool of guards' figures, each its own roll, cycled: quick.js refAt)
      figures[g.id] = libraryFigure(Array.isArray(guards.ref) ? guards.ref[k % guards.ref.length] : guards.ref);
      const rule = { type: 'ai', mind: { motivation: 'guard', aggressiveness: 'bold', perception: 'sight' }, sightRange: 14, sightCone: 0.6, scan: 1.3, scanPeriod: 7, guardRadius: 10, speed: 3, turnRate: 2.2, ...PERSON_BODY };
      entities.push({ id: g.id, rule, team: 'guards', body: { type: 'figure-rig', figure: g.id }, transform: { pos: lane ? onLane({ at: g.at }, lane).at : g.at, heading: g.heading } });
    }
    pilotPart = { ...pilotPart, figures, entities };
  }
  // EXTRA: what a goal stands in the stage beside the pilot (a defence's foes and towers: quick.js), the play it
  // brings (its cues), the blocks it stands (a shooter's cover) and what it gives the pilot (a shooter's rifle).
  // `extra(ends)` → { figures?, entities?, play?, blocks?, pilot?: { rule?, body?, weapon? }, camera?, posts?, pads?, inputs? }
  // (`camera`: laid over the pilot's own: a shooter's over the shoulder, a dogfight's mouse look)
  // (a level's own goal, `goalCast`: quick.js levelGoalCast, the same shape, or null when it stands nothing; its play
  // laid beside the systems' own, never over it)
  let extraPlay = null, blocks = null, posts = null, pads = null;
  const X = extra ? extra(ends) : goalCast ? goalCast(ends) : null;
  if (X) {
    const p0 = pilotPart.entities[0];
    // (a written feel wins over a goal's own feet: a deathmatch's shooter pole moves the pilot only where no feel is written)
    const feelOver = X.pilot?.rule && G.feel ? lowerFeel(feelCard(G.feel)).rule : null;
    const pilot = X.pilot ? { ...p0, ...X.pilot, rule: { ...p0.rule, ...(X.pilot.rule ?? {}), ...(feelOver ?? {}) }, body: { ...p0.body, ...(X.pilot.body ?? {}) } } : p0;
    const figures = { ...(pilotPart.figures ?? {}), ...(X.figures ?? {}) };
    pilotPart = { ...pilotPart, ...(Object.keys(figures).length ? { figures } : {}), entities: [pilot, ...pilotPart.entities.slice(1), ...(X.entities ?? [])], ...(X.camera && pilotPart.camera ? { camera: { ...pilotPart.camera, ...X.camera } } : {}) };
    extraPlay = X.play ?? null;
    blocks = X.blocks?.length ? X.blocks : null;
    posts = X.posts ?? null;
    // keys it brings (a bag on I): the pilot's inputs
    if (X.inputs?.length) pilotPart = { ...pilotPart, events: { ...(pilotPart.events ?? {}), inputs: [...(pilotPart.events?.inputs ?? []), ...X.inputs] } };
    pads = X.pads ?? null;
    // the game mechanics it brings (battles.js: the party carried, the defeat)
    if (X.mechanics?.length) game.mechanics = [...game.mechanics, ...X.mechanics];
  }
  // SEATS (the cube's soul.seats): a body per extra seat beside the hero, once the goal has dressed the hero
  let seats = null;
  if (seatable) ({ pilotPart, seats } = seatPart(G, pilotPart, ends, lane));
  // LOOP (the intent's `loop` concern): a low wall down the oval's middle
  if (ends.loop) blocks = [...(blocks ?? []), ...loopBlocks(ends.loop, ends)];
  // ARENA (the intent's `arena` concern): its wall, lanes and cover; the arena is the fight's cover and sightlines, so
  // the trail's posts take none
  if (ends.arena) blocks = [...(blocks ?? []), ...ends.arena.blocks];
  // COVER (the intent's `cover` concern): by the goal's fighting posts, else by the trail's beats
  if (concerns.includes('cover') && stage.section === 'trail' && !ends.arena) {
    posts ??= beatPosts(ends);
    const cover = coverBlocks(posts, ends);
    if (cover.length) blocks = [...(blocks ?? []), ...cover];
  }
  // REACHABLE (the intent's `reachable` concern): with a pilot that jumps, every other pickup on steps a jump climbs
  const jump = concerns.includes('reachable') && stage.section === 'trail' ? jumpHeight(pilotPart.entities[0].rule) : 0;
  let raised = [];
  if (jump) {
    const R = raisePickups(game.mechanics, ends, jump);
    if (R.raised.length) { game.mechanics = R.mechanics; blocks = [...(blocks ?? []), ...R.blocks]; raised = R.raised; }
  }
  // WATCHERS (the intent's `watchers` concern): a wall on each watcher's approach, a place behind it out of its sight
  const watched = concerns.includes('watchers') && stage.section === 'trail' && !ends.arena ? (watchers ?? posts ?? beatPosts(ends)) : null;
  if (watched?.length) blocks = [...(blocks ?? []), ...blindBlocks(watched, ends)];
  if (ways && ways.arrive.length) {
    const pilot = pilotPart.entities[0].id, ev = pilotPart.events || {};
    const moves = ways.arrive.map((a) => ({ on: `arrive:${a.from}`, do: 'move', target: pilot, to: lane ? onLane({ at: a.at }, lane).at : a.at }));
    pilotPart = { ...pilotPart, events: { ...ev, reactions: [...(Array.isArray(ev.reactions) ? ev.reactions : []), ...moves] } };
  }
  // POWER KEYS (a map world): every stage hears what the hero holds, and a held power with a move changes the hero's rule
  const pk = map ? powerKeys(G) : [];
  if (pk.length) {
    game.consumes = [{ slice: 'powers' }];
    const base = heroRef ? pilotPart.entities[0].rule : null;
    const grants = Object.fromEntries(base ? pk.filter((p) => p.move).map((p) => [p.id, TRAVERSAL_MOVES[p.move].rule(base)]) : []);
    if (Object.keys(grants).length) game.powers = { slice: 'powers', target: pilotPart.entities[0].id, grants };
    // a power that gives the wall or the line: the pilot's figure plays their states' fallbacks from the start
    if (Object.values(grants).some((g) => g.wall || g.gear) && pilotPart.figures) pilotPart = { ...pilotPart, figures: Object.fromEntries(Object.entries(pilotPart.figures).map(([k, f]) => [k, f && f.clips ? { ...f, clips: traversalStates(f.clips) } : f])) };
  }
  let play;
  ({ pilotPart, play } = storyPart(G, stage, ends, lane, pilotPart, extraPlay ? mergePlay(mechanics?.play ?? {}, extraPlay) : mechanics?.play ?? null, { story, carryFrom, party, castFigures }));
  const manifest = { ...stage.manifest, title: name, ...pilotPart, ...(play ? { play } : {}), ...(blocks ? { blocks } : {}), ...(mechanics?.destruction ? { destruction: mechanics.destruction } : {}), ...(audio ? { audio } : {}), ...(G.style?.pixel ? { pixel: G.style.pixel } : {}), ...juiceOf(G), ...(seats ? { seats } : {}), game };
  // the concerns' laws over what was laid (lay-concerns.js): advisory, for the run's readout
  // a roadway's laws are its own (its census: roads/track.js trackLaws); a trail's, its concerns'
  const laws = stage.section === 'roadway' ? ends.roadLaws : stage.section === 'airspace' ? ends.airLaws : stage.section === 'runner' ? [] : concerns.length ? concernLaws(concerns, { ends, blocks: blocks ?? [], posts: posts ?? [], watchers: watched ?? [], pads: pads ?? [], raised, jump, mechanics: game.mechanics, loop: ends.loop, arena: ends.arena }) : [];
  return { tool: 'create_sketch', args: { title: name, manifest }, ends, ...(laws.length ? { laws } : {}) };
}

/** SEATS (pilots.plan.md; docs/local-multiplayer-principles.md): a world whose cube says soul.seats two or four lays,
 * beside the hero's spawn, a body per extra seat (`hero-2`…): the hero itself, dressed as the goal dressed it, on the
 * hero's rule, its seat's ring its colour. While its seat is empty it follows the hero on the party's escort motive (the
 * seat's `drop: 'ai'`); all of them on the hero's side. The manifest's `seats` names them for the page (soul.join: drop-in
 * or lobby) and, when the cube says soul.pool, the lives a fall costs (each seat's own, or one count shared). One seat,
 * or none said, lays nothing. */
const SEAT_COUNT = Object.freeze({ two: 2, four: 4 }), SEAT_LIVES = 3;
function seatPart(G, pilotPart, ends, lane) {
  const soul = cubeOfWorld(G).cube.soul ?? {}, n = SEAT_COUNT[soul.seats];
  if (!n) return { pilotPart, seats: null };
  const entities = [...pilotPart.entities], p0 = entities[0], h = ends.heading, s = ends.spawn, side = p0.team ?? 'party';
  entities[0] = { ...p0, team: side };
  const ambient = { type: 'ai', mind: { motivation: 'escort' }, escort: p0.id, followDist: 2.5, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(Number.isFinite(p0.rule?.speed) ? { speed: p0.rule.speed } : {}) };
  const bodies = [];
  for (let k = 2; k <= n; k++) {
    // behind the hero and to either side; run side on, a step ahead each along the lane (behind its start is off it)
    const back = lane ? -(k - 1) : (k - 1) * 1.2, aside = lane ? 0 : (k % 2 ? -1 : 1) * 0.9;
    const at0 = [r3(s[0] - Math.cos(h) * back - Math.sin(h) * aside), r3(s[1] - Math.sin(h) * back + Math.cos(h) * aside), s[2]];
    const id = `${p0.id}-${k}`;
    entities.push({ ...p0, id, team: side, ambient, transform: { pos: lane ? onLane({ at: at0 }, lane).at : at0, heading: h } });
    bodies.push(id);
  }
  // lives (soul.pool): each seat three of its own, or three a seat in one count the seats share; a fall costs one
  const lives = soul.pool === 'own' ? { lives: SEAT_LIVES, pool: 'own' } : soul.pool === 'shared' ? { lives: SEAT_LIVES * n, pool: 'shared' } : {};
  return { pilotPart: { ...pilotPart, entities }, seats: { bodies, max: n, join: soul.join === 'lobby' ? 'lobby' : 'drop-in', ...lives } };
}

// the systems' play and what a goal or the battles bring: the lists (cues, menus, parts, spots, routines) one after the
// other, the items together, the rest the extra's (a quick goal has no systems, so its play is the extra's own, as it was)
const PLAY_LISTS = ['cues', 'menus', 'parts', 'spots', 'routines'];
function mergePlay(base, extra) {
  if (!base) return extra;
  const out = { ...base, ...extra };
  for (const k of PLAY_LISTS) if (Array.isArray(base[k]) && Array.isArray(extra[k])) out[k] = [...base[k], ...extra[k]];
  if (base.items && extra.items) out.items = { ...base.items, ...extra.items };
  return out;
}

/** The story's share of a stage, on its pilot and its play: the level's scenes and the story's moments (with their
 * places as spots), the cast who stand in them, the party who join, the quests' journal. Nothing to add: the same
 * pilot part and play back. */
// (a cast member's figure on the field: stage-figures.js fieldFigure, its own moves over the library's, or a body the
// library does not fit on its own clips)

function storyPart(G, stage, ends, lane, pilotPart, basePlay, { story = null, carryFrom = null, party = null, castFigures = null } = {}) {
  // SCENES (the level's, playscape/ui/scenes.js): the ones this stage plays, its places as spots to frame and walk to,
  // and the story slice carried when the world's scenes use flags
  const scenes = [...(G.scenes?.[stage.level] ?? []).filter((s) => (s.stage ?? (stage.index === 0 ? stage.node : null)) === stage.node).map(({ stage: _, ...s }) => s), ...(story?.scenes ?? [])];
  // THE STORY's people in this stage (story.js bindStory): each a made cast figure standing at its place, after the
  // pilot (entities[0] stays the pilot)
  if (story?.cast?.length) {
    const figures = { ...(pilotPart.figures ?? {}) }, entities = [...pilotPart.entities];
    for (const c of story.cast) {
      // (a rolled body that does not walk the field yet, a beast or a mascot, is not stood in it)
      if (!c.ref || castFigures?.[c.id] === null) continue;
      stand({ figures, entities }, c.id, fieldFigure(c.ref, castFigures?.[c.id]), c.at, c.heading);
    }
    pilotPart = { ...pilotPart, figures, entities };
  }
  // THE PARTY (playscape/ui/party.js): each cast member who joins on a flag, in every stage, on the escort motive. One
  // the story stands here waits at its stand until it joins; elsewhere it is minted asleep behind the start and wakes
  // when the flag is set or carried in.
  const joiners = (party ?? []).filter((p) => p.ref && castFigures?.[p.id] !== null), members = [], stands = [];
  if (joiners.length) {
    const figures = { ...(pilotPart.figures ?? {}) }, entities = [...pilotPart.entities], pilot = entities[0], h = ends.heading;
    // (on the pilot's own side when it has one: a team game's; else a side of their own)
    const side = pilot.team ?? 'party';
    joiners.forEach((p, i) => {
      figures[p.id] ??= fieldFigure(p.ref, castFigures?.[p.id]);
      const rule = { type: 'ai', mind: { motivation: 'escort' }, escort: pilot.id, followDist: 2.5, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(Number.isFinite(pilot.rule?.speed) ? { speed: pilot.rule.speed } : {}) };
      const k = entities.findIndex((e) => e.id === p.id);
      if (k >= 0) {
        // one the story stands here: waits at its stand until it joins, or (with the pilot from the start) follows at once
        entities[k] = { ...entities[k], rule, team: side };
        if (p.joins) {
          stands.push({ id: `stand-${p.id}`, at: entities[k].transform.pos.slice(0, 2) });
          members.push({ who: p.id, joins: p.joins, at: `stand-${p.id}` });
        } else members.push({ who: p.id });
      } else {
        const back = 2 + i * 1.2, aside = (i % 2 ? -1 : 1) * 1.2, s = ends.spawn;
        const at = [r3(s[0] - Math.cos(h) * back - Math.sin(h) * aside), r3(s[1] - Math.sin(h) * back + Math.cos(h) * aside), s[2]];
        entities.push({ id: p.id, rule, team: side, dormant: true, body: { type: 'figure-rig', figure: p.id }, transform: { pos: at, heading: h } });
        members.push({ who: p.id, ...(p.joins ? { joins: p.joins } : {}) });
      }
    });
    pilotPart = { ...pilotPart, figures, entities };
  }
  let play = basePlay;
  // (a party all with the pilot from the start carries no flag between levels)
  if (members.length) play = { ...(play ?? {}), party: members, ...(stands.length ? { spots: [...(play?.spots ?? []), ...stands] } : {}), ...(members.some((m) => m.joins) ? { carry: STORY_SLICE } : {}) };
  // THE QUESTS (story.js, playscape/ui/quests.js): every stage keeps the journal, its flags carried in the story slice
  if (G.quests?.length) play = { ...(play ?? {}), quests: levelQuests(G.quests), carry: STORY_SLICE };
  if (scenes.length) {
    const spots = stageSpots(ends, lane);
    // where a scene's has and done read: the game's inventories and its campaign (only when its scenes ask)
    const asks = sceneNeeds({ scenes }), from = carryFrom && (asks.items.length || asks.done.length) ? carryFrom : null;
    play = { ...(play ?? {}), spots: [...(play?.spots ?? []), ...spots], scenes, ...(storyCarried(G) ? { carry: STORY_SLICE } : {}), ...(from ? { carryFrom: from } : {}) };
  }
  return { pilotPart, play };
}

/** A stage's places by name: its start (the spawn), its exit, its pockets and landmarks in trail order (pocket,
 * pocket-2…), each on the lane when the stage is run side on. */
export function stageSpots(ends, lane = null) {
  const at = (p) => (lane ? onLane({ at: p }, lane).at : p);
  const named = (kind) => ends.beats.filter((b) => b.beat === kind).map((b, i) => ({ id: i ? `${kind}-${i + 1}` : kind, at: at(b.at) }));
  return [{ id: 'start', at: at(ends.spawn) }, { id: 'exit', at: at(ends.exit) }, ...named('pocket'), ...named('landmark')];
}

/** The flags slice a world's scenes ride between levels, when any of them reads or sets a flag. */
export const STORY_SLICE = 'story';
export const storyCarried = (G) => Object.values(G.scenes ?? {}).some((list) => sceneFlags({ scenes: list.map(({ stage: _, ...s }) => s) }).length > 0)
  || sceneFlags({ scenes: (G.story ?? []).map((m) => storyScene(m)) }).length > 0 || !!G.quests?.length
  || Object.values(G.characters?.cast ?? {}).some((m) => m.joins);

/**
 * A side-scroller's lane on a stage: the trail's own spine, one point a metre on the ground plane, the way the trail
 * runs (spawn to exit), and the ground under it. A climb has no spine to run, so a side camera refuses it by name.
 */
export function stageLane(stage) {
  if (stage.manifest.trail === undefined) throw new Error(`levels: a side camera runs a trail's lane, and the stage '${stage.level}/${stage.node}' is a climb with no trail to run; play this world top-down or third-person, or leave the climb out`);
  const { site } = outTrailOf(stage.manifest), line = [];
  for (let y = 0; y <= site.D + 1e-9; y += 1) line.push([r3(site.trailX(y)), r3(y)]);
  return { line, ground: (x, y) => site.ground(x, y) };
}

/** A goal's placed points moved onto the lane (pockets and landmarks sit off the trail, where a lane cannot reach), each
 * at the height it stood above its own ground. */
function onLane(m, lane) {
  const move = (at) => {
    let best = Infinity, q = at;
    for (let i = 1; i < lane.line.length; i++) {
      const [ax, ay] = lane.line[i - 1], dx = lane.line[i][0] - ax, dy = lane.line[i][1] - ay, L2 = dx * dx + dy * dy || 1e-12;
      const u = Math.max(0, Math.min(1, ((at[0] - ax) * dx + (at[1] - ay) * dy) / L2)), x = ax + dx * u, y = ay + dy * u;
      const d2 = (at[0] - x) ** 2 + (at[1] - y) ** 2;
      if (d2 < best) { best = d2; q = [x, y]; }
    }
    return [r3(q[0]), r3(q[1]), r3(lane.ground(q[0], q[1]) + (at[2] - lane.ground(at[0], at[1])))];
  };
  return {
    ...m,
    ...(Array.isArray(m.at) ? { at: move(m.at) } : {}),
    ...(Array.isArray(m.pickups) ? { pickups: m.pickups.map((pk) => ({ ...pk, at: move(pk.at) })) } : {}),
    ...(Array.isArray(m.hazards) ? { hazards: m.hazards.map((h) => ({ ...h, at: move(h.at) })) } : {}),
  };
}

/**
 * THE MAP of an interconnected world: for each stage (in gameStages order), the ways out of it and where they lead. The
 * stages of one level join both ways; a link joins its `from` level's last stage and its `to` level's first, both ways;
 * a keyed link locks the way from `from` to `to` with `{ has: key }`, and lays the key on `keyAt`'s last stage.
 *   mapPlan(G, stages, refs) → [{ on: [way], back: [way], keys: [item] }]   way: { id, to: ref, gate? }
 */
/** A map world's keys that are the hero's powers (picked up into `powers`, not the bag), each with its move, or null. */
export function powerKeys(G) {
  if (G.topology !== 'interconnected') return [];
  const powers = G.characters?.hero?.actions?.powers ?? [];
  const keyed = new Set(G.links.filter((l) => l.key).map((l) => l.key));
  return powers.filter((p) => keyed.has(p.id)).map((p) => ({ id: p.id, move: p.move ?? null }));
}

export function mapPlan(G, stages, refs) {
  const plan = stages.map(() => ({ on: [], back: [], keys: [], powers: [] }));
  const isPower = new Set(powerKeys(G).map((p) => p.id));
  const of = (lvl) => stages.map((s, i) => (s.level === lvl ? i : -1)).filter((i) => i >= 0);
  for (const id of G.ids) {
    const ix = of(id);
    // a city's segments join each other at their own portals (cityStages), not one after another
    if (ix.length && stages[ix[0]].section === 'city') continue;
    for (let k = 0; k + 1 < ix.length; k++) { plan[ix[k]].on.push({ to: refs[ix[k + 1]] }); plan[ix[k + 1]].back.push({ to: refs[ix[k]] }); }
  }
  for (const l of G.links) {
    const a = of(l.from), b = of(l.to);
    if (!a.length || !b.length) continue;
    const last = a[a.length - 1], first = b[0];
    const slice = isPower.has(l.key) ? 'powers' : 'bag';
    plan[last].on.push({ to: refs[first], ...(l.key ? { gate: { has: l.key, slice } } : {}) });
    plan[first].back.push({ to: refs[last] });
    if (l.key) { const at = of(l.keyAt); plan[at[at.length - 1]][slice === 'powers' ? 'powers' : 'keys'].push(l.key); }
  }
  for (const p of plan) {
    p.on.forEach((w, j) => { w.id = j ? `on-${j + 1}` : 'on'; });
    p.back.forEach((w, j) => { w.id = j ? `back-${j + 1}` : 'back'; });
  }
  return plan;
}

/** A stage's ways out laid on its own ground: the first way on at the trail's exit, the first way back just behind
 * the spawn, any more at its pockets then its landmarks; a key on a beat of its own; and for each way, the point a pilot
 * coming in by it arrives at, a few metres inside (the way back's arrival is the spawn itself). */
function stageWays(stage, ends, plan) {
  if (stage.manifest.trail === undefined) throw new Error(`levels: a map world's stages are trails, whose ends and pockets carry its ways; '${stage.level}/${stage.node}' is a climb`);
  const side = ends.beats.filter((b) => b.beat === 'pocket').concat(ends.beats.filter((b) => b.beat === 'landmark'));
  const h = ends.heading, behind = [r3(ends.spawn[0] - 2.4 * Math.cos(h)), r3(ends.spawn[1] - 2.4 * Math.sin(h)), ends.spawn[2]];
  const toward = (p, q, d) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, t = Math.min(1, d / L); return [r3(p[0] + (q[0] - p[0]) * t), r3(p[1] + (q[1] - p[1]) * t), r3(p[2] + (q[2] - p[2]) * t + 1)]; };
  const extra = [...plan.on.slice(1), ...plan.back.slice(1)];
  if (extra.length > side.length) throw new Error(`levels: '${stage.level}/${stage.node}' has ${extra.length + 2} ways out and room for ${side.length + 2} (its exit, its start, ${side.length} pocket or landmark beat${side.length === 1 ? '' : 's'}): link fewer levels to it`);
  const spot = new Map();
  if (plan.on[0]) spot.set(plan.on[0], { at: ends.exit, arrive: toward(ends.exit, ends.spawn, 4) });
  if (plan.back[0]) spot.set(plan.back[0], { at: behind, arrive: null });
  extra.forEach((w, j) => spot.set(w, { at: side[j].at, arrive: toward(side[j].at, ends.spawn, 3) }));
  const mechanics = [], arrive = [];
  for (const w of [...plan.on, ...plan.back]) {
    const s = spot.get(w);
    mechanics.push({ kind: 'reach-exit', exit: w.id, at: s.at, radius: w === plan.back[0] ? 1.2 : 2.5, ...(ends.planar ? {} : { planar: false }) });
    if (s.arrive) arrive.push({ from: w.to, at: s.arrive });
  }
  // the keys found here, on a beat of their own: items into the bag, powers into `powers` (one row of pickups)
  const found = [...plan.keys.map((item) => ({ item, into: 'bag' })), ...(plan.powers ?? []).map((item) => ({ item, into: 'powers' }))];
  if (found.length) {
    const free = ends.beats.filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead' && !extra.some((_, j) => side[j] === b));
    const beat = free[Math.floor(free.length / 2)] ?? ends.beats[Math.floor(ends.beats.length / 2)];
    const at = (j) => [beat.at[0] + j * 1.5, beat.at[1], beat.at[2]];
    for (const into of ['bag', 'powers']) {
      const row = found.map((f, j) => ({ ...f, j })).filter((f) => f.into === into);
      if (row.length) mechanics.push({ kind: 'collect', into, pickups: row.map((f) => ({ item: f.item, at: at(f.j), radius: 1.6 })) });
    }
  }
  return { mechanics, arrive, exits: [...plan.on, ...plan.back].map((w) => ({ id: w.id, to: w.to, ...(w.gate ? { gate: w.gate } : {}) })) };
}

/**
 * The game's store, from the book: the hero (a character slice, started at the systems' base numbers), the gear (an
 * inventory slice, when the table has a filled class), the campaign (a progression slice: each level unlocks the next).
 * `book` is resolveBook's.
 */
export function gameStore(world, book) {
  const G = laidBattles(readGameworld(world)), S = book?.mechanics?.play.stats;
  const stats = S ? Object.fromEntries(S.stats.filter((x) => Number.isFinite(x.base ?? x.value)).map((x) => [x.id, x.base ?? x.value])) : {};
  const slices = [{ name: 'hero', kind: 'character', ...(Object.keys(stats).length ? { init: { stats } } : {}) }];
  if (resolveEquipment(G).rows.some((r) => r.build)) slices.push({ name: 'gear', kind: 'inventory' });
  slices.push({ name: 'campaign', kind: 'progression' });
  // a map world whose doors are keyed carries the items in a bag and the hero's powers in `powers`
  const pk = new Set(powerKeys(G).map((p) => p.id));
  if (G.topology === 'interconnected' && G.links.some((l) => l.key && !pk.has(l.key))) slices.push({ name: 'bag', kind: 'inventory' });
  // a level whose goal collects picks up into the bag (its own goal: quick.js levelGoalMechanics)
  else if (G.ids.some((id) => G.levels[id].goal?.collect)) slices.push({ name: 'bag', kind: 'inventory' });
  if (pk.size) slices.push({ name: 'powers', kind: 'inventory' });
  // the world's scenes read and set flags: a story slice carries them from level to level
  if (storyCarried(G)) slices.push({ name: STORY_SLICE, kind: 'flags' });
  // the world remembers what broke (a game that lets things break): each level keeps its breaks here
  if (book?.mechanics?.destruction && book.mechanics.destruction !== 'none') slices.push({ name: AFTERMATH_SLICE, kind: 'flags' });
  // party battles (battles.js): the party, its levels, classes and skills, carried from level to level
  if (G.battles) {
    slices.push({ name: PARTY_SLICE, kind: 'party', init: { roster: battleRoster(G) } });
    // and its bag: items, the gear not worn, gold (a keyed map's bag is the same slice, its keys beside them)
    const bag = slices.findIndex((x) => x.name === BAG_SLICE), init = { items: { ...BAG_START } };
    if (bag < 0) slices.push({ name: BAG_SLICE, kind: 'inventory', init }); else slices[bag] = { ...slices[bag], init };
  }
  // the minigames' winnings (minigames.js): gold in a bag carried from level to level
  if (G.minigames && !slices.some((x) => x.name === BAG_SLICE)) slices.push({ name: BAG_SLICE, kind: 'inventory' });
  return { slices };
}

/** The create_game `levels` list: the stages' level refs in walking order, each after the first unlocked by the one
 * before it (`refs` in the order of gameStages). */
export function gameLevels(stages, refs, plan = null) {
  // a map world (`plan`: mapPlan's): no chain of gates; each level lists its exits, and the first level is where it starts
  if (plan) {
    return stages.map((s, i) => {
      // a city's segment leaves by its portals too, each named for the neighbour it leads to
      const portals = s.section === 'city' ? s.city.neighbours.map((id) => ({ id, to: refs[stages.findIndex((x) => x.level === s.level && x.node === id)] })).filter((x) => x.to) : [];
      const exits = [...plan[i].on, ...plan[i].back].map((w) => ({ id: w.id, to: w.to, ...(w.gate ? { gate: w.gate } : {}) })).concat(portals);
      return { ref: refs[i], title: `${s.level} · ${s.node}`, ...(exits.length ? { exits } : {}) };
    });
  }
  // an inside is entered by its door, never gated; the walk's stages unlock each other in order, skipping insides
  const prev = (i) => { for (let j = i - 1; j >= 0; j--) if (stages[j].section !== 'interior') return j; return -1; };
  return stages.map((s, i) => ({ ref: refs[i], title: `${s.level} · ${s.node}`, ...(s.section !== 'interior' && prev(i) >= 0 ? { gate: { completed: refs[prev(i)] } } : {}) }));
}

/** A nature or jungle stage's palette data (color-theorist/recolour.js reads it), from the world's palette spec; null
 * for any other kit, or no palette. */
function paintedPalette(manifest, spec) {
  if (!spec || !manifest?.kit || !['nature', 'jungle'].includes(stageKit(manifest.kit)?.shell)) return null;
  const K = solvePalette(spec === 'auto' ? {} : spec);
  return { from: K.spec, ...natureColours(K) };
}

/**
 * A building's rooms in the world's palette (color-theorist): a room kit that takes an art direction is given one,
 * rolled from a seed the palette and the stage decide (so the same world lays the same rooms on every run), its
 * palette the level's (the world's, or the world's moved by its script). A world with no palette, a kit with no art direction, or a stage with its own `art` or `tone`
 * is left as it was.
 */
function inPalette(manifest, P, at) {
  if (!P || !manifest || manifest.art !== undefined || manifest.tone !== undefined || !ART_KITS.includes(manifest.kit)) return manifest;
  const K = solvePalette(P === 'auto' ? {} : P), seed = (parseInt(printOf([K.id, at]), 16) % 2147483646) + 1;
  const status = Object.fromEntries(ART_ITEMS.map((k) => [k, 'auto']));
  return { ...manifest, art: { seed, ...rollArt(manifest.kit, seed), palette: { seed: K.spec.seed, from: K.spec, ...artPalette(K) }, status } };
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
function buildingLevelOrder(G, stage, { ref, heroRef, heroGaits = null, pilot = null, mechanics = null, title, goal = null, goalCast = null, extra = null, story = null, carryFrom = null, party = null, castFigures = null } = {}) {
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
  // (the goal room's floor, under the exit at the walker's eye: where a level goal's boss stands)
  const exit0 = ends.exit;
  Object.defineProperty(ends, 'bossAt', { value: [exit0[0], exit0[1], r3(exit0[2] - eye)], enumerable: false });
  // its rooms (each its box and floor) and its use, for a stage's extra to stand things in (a minigame's stall)
  Object.defineProperty(ends, 'rooms', { value: plan.rooms.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, d: r.d, z: floors ? floors.get(r.id) : 0 })), enumerable: false });
  Object.defineProperty(ends, 'use', { value: stage.building.use, enumerable: false });
  // a quick goal: its mechanics beside the building's own goal (which keeps its route through the doorways)
  if (goal) {
    const own = goal(ends), extra = own.filter((x) => x.kind !== 'reach-exit');
    base = { ...base, level: { ...base.level, ...(extra.length ? { mechanics: extra } : {}), ...(own.some((x) => x.kind === 'reach-exit') ? {} : { exit: false }) } };
  }
  // a level's own goal's cast (quick.js levelGoalCast): its play beside the systems', its keys the walker's; a figure
  // it stands (a boss) beside the pilot, so the level's lowering keeps them (structure/level.js keeps a recipe's own
  // pilot): the stage's own first-person walker, when no hero pilots it
  // (and the stage's extra beside it: the minigames' stalls in its rooms, their mechanics the level's)
  const X = mergeExtras(goalCast ? goalCast(ends) : null, extra ? extra(ends) : null);
  if (X?.play) base = { ...base, play: mergePlay(base.play, X.play) };
  if (extra && X?.mechanics?.length) base = { ...base, level: { ...base.level, mechanics: [...(base.level?.mechanics ?? []), ...X.mechanics.filter((m) => !(base.level?.mechanics ?? []).some((x) => x.kind === m.kind && x.slice === m.slice))] } };
  if (!heroRef) {
    if (X?.entities?.length) base = { ...base, figures: { ...(base.figures ?? {}), ...X.figures }, entities: [walker, ...X.entities], camera: lowered.camera };
    if (X?.inputs?.length) base = { ...base, events: { ...(base.events ?? {}), inputs: [...(base.events?.inputs ?? []), ...X.inputs] } };
    return { tool: 'create_sketch', args: { title: name, manifest: { ...base, ...juiceOf(G) } }, ends };
  }
  // a hero with the wall or the line (actions.moves) plays it under its rooms' ceilings, laid as colliders (era/anchors.js)
  const moves = heroMoves(G);
  if (moves) base = { ...base, ceilings: true };
  const controls = `W / S  run · A / D  turn · Space  jump${movesLegend(moves)}${X?.legend ? ` · ${X.legend}` : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const P = withMoves(playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), id: 'hero', title: name, controls }), moves);
  const inputs = [...(P.events?.inputs ?? []), ...(mechanics?.inputs ?? []), ...(X?.inputs ?? [])];
  const events = { ...(P.events || {}), ...(inputs.length > (P.events?.inputs?.length ?? 0) ? { inputs } : {}) };
  const pilot0 = { figures: X?.figures ? { ...P.figures, ...X.figures } : P.figures, entities: [{ ...P.entities[0], transform: { pos: spawn, heading } }, ...(X?.entities ?? [])], camera: P.camera, events };
  // the story's share (its quests, its party; its moments bind to a building's start and goal), as a stage's
  const play0 = base.play ?? null, { pilotPart, play } = storyPart(G, stage, ends, null, pilot0, play0, { story, carryFrom, party, castFigures });
  const manifest = { ...base, ...pilotPart, ...(play !== play0 ? { play } : {}), ...juiceOf(G) };
  return { tool: 'create_sketch', args: { title: name, manifest }, ends };
}
