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
import { errandLegs, layErrand } from './errand.js';
import { readGameworld, resolveLevel, looksOfKit } from './world.js';
import { assembleGeotownScene, GEOTOWN_KEYS } from '../geotown/scene.js';
import { SURFACE_IDS as GEOTOWN_SURFACES } from '../geotown/pattern.js';
import { rollArt, ART_KITS, ART_ITEMS } from '../era/art-direction.js';
import { solvePalette, fingerprint as printOf } from '../color-theorist/solve.js';
import { artPalette, natureColours } from '../color-theorist/adapters.js';
import { layLevel } from '../level/index.js';
import { assembleStageScene, planStage, stageKit } from '../era/stage.js';
import { ladderParams, climbSurface, LADDER, LADDER_VARIANTS } from '../playscape/objects/ladder.js';
import { withGeocube } from '../era/geocube.js';
import { playerWorld, traversalStates, HERO_WALK_RUN } from '../playscape/player.js';
import { resolveEquipment } from './equipment.js';
import { outTrailOf } from '../era/out-trail-board.js';
import { TRAVERSAL_MOVES, HERO_MOVES } from './actions.js';
import { RIDE_H } from './ride.js';
import { fixedStations, uprightCamera, STEERED } from './cameras.js';
import { SHOOT, PERSON, shoulderOf } from './quick.js';
import { HOLDER } from './mechanics.js';
import { readScreen } from '../game/screen.js';
import { cubeOfWorld } from './intent.js';
import { concernIds } from './concerns.js';
import { SPACING, beatPosts, coverBlocks, blindBlocks, concernLaws, jumpHeight, raisePickups, loopOn, loopBlocks, arenaOn, arenaLayout } from './lay-concerns.js';
import { sceneFlags, sceneNeeds, FLAGS_READY, flagVar } from '../playscape/ui/scenes.js';
import { storyScene, levelQuests } from './story.js';
import { withBuildingLevel, PROBE } from '../structure/level.js';
import { complexRoute, complexLaws } from '../network/complex.js';
import { withProgram, PROGRAMS } from '../era/programs.js';
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
import { mergeExtras, libraryFigure, fieldFigure, stand } from './stage-figures.js';
import { standFoe } from './foes.js';

/** A sneak's guard: a guard in a person's skin (foes/classes/guard.js), and what the sneak plays it at: a watcher whose
 * sighting ends the run (the `unseen` mechanic reads its team), never fought, kept near its post. */
const SNEAK_GUARD = Object.freeze({ class: 'guard', skin: { people: 'human' } });
// THE BODY'S OWN BLOW (adornment.js BASIC_VERBS 'strike'): a hero carrying an item in its right hand for its strike
// swings it. The pilot's rule takes the runtime's own contact window (combat-melee.js meleeSwingSpec's: the downstroke of
// the swing clip) where no feel names one; the world's page arms the rule with what the figure holds, its reach, seconds
// and damage (world-scene.js, the held strike). A hero carrying nothing for it, as it was.
const HELD_CONTACT = Object.freeze([0.28, 0.62]);
const carriesStrike = (G) => (G.characters?.hero?.adornment?.items ?? []).some((it) => it.slot === 'right' && (it.serves ?? []).includes('strike'));
const strikeWindow = (G, rule) => (carriesStrike(G) && !Array.isArray(rule?.strikeContact) ? { strikeContact: [...HELD_CONTACT] } : null);
const STRIKE_LEGEND = 'click  strike';
// THE BODY'S OWN SHOT (adornment.js BASIC_VERBS 'shoot'): a hero carrying a firearm in its right hand for its shot fires
// it as the quick shooter's player does (quick.js shootCast): a pistol the handgun's numbers, a long gun the rifle's,
// fired from the eye; its body hittable; played third person, over the shoulder (its rounds converging on the
// crosshair). A hero carrying nothing for it, as it was.
const shotItem = (G) => (G.characters?.hero?.adornment?.items ?? []).find((it) => it.slot === 'right' && (it.serves ?? []).includes('shoot')) ?? null;
const FIRE_LEGEND = 'click  fire';
// A STEP IN: a building's way in has the wall at its back, and the hero's chase is pulled in against it
// (follow-pull-in.js) until the hero's back fills the frame. The hero starts a few steps into the entry room, along its
// heading, where the room holds that point (half a metre clear of its walls); the level's own ends stay at the door
const STEP_IN = 2.5;
function steppedIn(plan, spawn, heading) {
  const r = plan.rooms.find((x) => x.id === plan._program.entry), q = [r3(spawn[0] + Math.cos(heading) * STEP_IN), r3(spawn[1] + Math.sin(heading) * STEP_IN), spawn[2]];
  return r && q[0] > r.x + 0.5 && q[0] < r.x + r.w - 0.5 && q[1] > r.y + 0.5 && q[1] < r.y + r.d - 0.5 ? q : spawn;
}
function armedPilot(G, entity, cam) {
  const it = shotItem(G);
  if (!it) return { entity, camera: null };
  const over = shoulderOf(cam ?? 'third-person', true), gun = it.build?.item === 'pistol' ? SHOOT.gun : SHOOT.rifle;
  return {
    entity: { ...entity, weapon: { ...gun, eye: 1.5, ...(over ? { converge: true } : {}) }, body: { ...entity.body, hittable: true, radius: 0.5, egg: { ...PERSON, cz: PERSON.c } } },
    camera: over ? { rule: 'follow', target: entity.id, ...over } : null,
  };
}
const SNEAK_TUNE = Object.freeze({ team: 'guards', rule: { guardRadius: 10, speed: 3, turnRate: 2.2 }, body: { hittable: false } });
import { feelRule, readFeel, TAKES, feelCard, lowerFeel, feelVayo } from './feel/lower.js';
import { reachOf } from './feel/reach.js';
import { laidCasting, laidJoins } from './casting.js';
import { readCourse, courseAt, coursePlan, courseLaws, lowerCourse } from './course.js';
import { juiceOfGame } from './juice.js';
import { tempoOfGame } from './tempo.js';
import { gradeOfGame } from './grade.js';
import { readBuildingParked, parkIn, paintOfDress } from '../vehicle-registry/parked.js';
import { roleOf } from '../era/stocking.js';
import { camoForSetting } from '../car-designer/livery-cut.js';

// the world's juice (juice.js): its effects' floor, composed from its register and its game type, on every level; none
// written, nothing laid
const juiceOf = (G) => { const J = juiceOfGame(G); return J ? { fxStyle: J.fxStyle } : {}; };
// the world's clock (tempo.js): the moments that slow or hold its live levels, on every level; none written, nothing laid
const tempoOf = (G) => { const T = tempoOfGame(G); return T ? { tempo: T.tempo } : {}; };
// the world's grade (grade.js): the look over every frame of its levels; none written, nothing laid
const gradeOf = (G) => { const R = gradeOfGame(G); return R ? { grade: R.grade } : {}; };

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
  const G = readGameworld(world), order = [G.start, ...G.ids.filter((id) => id !== G.start)], out = [], hours = {};
  for (const level of order) {
    const R = resolveLevel(G, level);
    if (R.style?.hour !== undefined) hours[level] = R.style.hour;
    // a building level is one stage: its rooms laid from its program (or the building already made, by ref)
    if (R.building) { out.push({ level, node: 'building', section: 'building', index: 0, building: R.building, manifest: levelBuildingStage(G, R, level) }); continue; }
    // a geotown level is one stage: the town on its cube (geotown/scene.js), walked from its streets
    if (R.geotown) {
      out.push({ level, node: 'town', section: 'geotown', index: 0, manifest: { kind: 'geocube', cube: R.geotown.cube, show: 'geotown', seed: R.seed, geotown: R.geotown.spec, ...(R.geotown.hour !== undefined ? { hour: R.geotown.hour } : {}), ...(R.geotown.enter?.length ? { enter: [...R.geotown.enter] } : {}) } });
      // (its houses entered at their doors, each a level of its own after the town, linked by its door)
      const st = out[out.length - 1];
      (stageEnds(st.manifest).doors ?? []).forEach((d, k) => out.push({ level, node: `town-${d.id}`, section: 'interior', index: k + 1, outside: { node: 'town', index: 0, door: d.id }, building: { use: d.inside.use }, manifest: inPalette(interiorStage(d.inside), R.style?.palette ?? G.style?.palette, `${level}/town-${d.id}`) }));
      continue;
    }
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
      // (a level that builds is solid, era/solid.js: no flat building polygons)
      const manifest = here.length || street || keep._keepOut || looks || painted ? { ...s.manifest, ...(here.length ? { buildings: here } : {}), ...(street ? { town: street } : {}), ...(here.length || street ? { solid: true } : {}), ...keep, ...(looks ? { looks } : {}), ...(painted ? { palette: painted } : {}) } : s.manifest;
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
  // the style's hour lights the outside of a stage its level's geocube paints (world.js resolveLevel); an outside stage
  // no cube paints (a section in its own kit, a level with no cube, a building, a city, a track…) is lit as before, and
  // says so (`unlit`: stageLevelOrder's advice). An inside has no outside to light. No hour: every stage as it was
  if (!Object.keys(hours).length) return out;
  const lit = (s) => ((s.section === 'trail' || s.section === 'meru') && s.manifest?.geocube !== undefined) || s.section === 'geotown';
  return out.map((s) => (hours[s.level] === undefined || s.section === 'interior' || lit(s) ? s : { ...s, unlit: hours[s.level] }));
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
// THE POWERS' MOVES the hero starts with (actions.js TRAVERSAL_MOVES): a power with a `move` the hero gains at the early
// stage (or any, where the page lays no stages) is granted from the first level, every level it plays; one that keys a
// map's door is found there instead (game.powers), and one gained later waits on its stage. → the move ids, or []
function startingGrants(G) {
  const A = G.characters?.hero?.actions;
  if (!A?.powers?.length) return [];
  const keyed = new Set(powerKeys(G).map((p) => p.id)), staged = (A.progression ?? []).length > 0;
  const early = new Set(staged ? (A.progression.find((s) => s.stage === 'early')?.gains ?? []) : A.powers.map((p) => p.id));
  return A.powers.filter((p) => p.move && early.has(p.id) && !keyed.has(p.id)).map((p) => ({ move: p.move, ...(p.element ? { element: p.element } : {}), ...vayoTune(G, p.move) }));
}
// a vayo move's tuning by the game's feel card (feel/lower.js feelVayo): only a power that grants one reads it
const vayoTune = (G, move) => { if (!G.feel || !String(move).startsWith('vayo-')) return {}; const t = feelVayo(feelCard(G.feel)); return t ? { tune: t } : {}; };
// THE LATER POWERS' MOVES: a power with a `move` gained after the starting stage (not one that keys a map's door) is the
// hero's the moment its node is gained (the stats' `bought`), and from the start of a level where it already is
// (game.powers `bought`, scene/channels/game.js). → [{ id, move }]
function laterGrants(G) {
  const A = G.characters?.hero?.actions, prog = A?.progression ?? [];
  if (!A?.powers?.length || !prog.length) return [];
  const keyed = new Set(powerKeys(G).map((p) => p.id)), early = new Set(prog.find((s) => s.stage === 'early')?.gains ?? []);
  return A.powers.filter((p) => p.move && !early.has(p.id) && !keyed.has(p.id) && prog.some((s) => s.gains.includes(p.id))).map((p) => ({ id: p.id, move: p.move, ...(p.element ? { element: p.element } : {}), ...vayoTune(G, p.move) }));
}
function withMoves(P, moves, grants = []) {
  if (!moves && !grants.length) return P;
  const figures = moves ? Object.fromEntries(Object.entries(P.figures || {}).map(([k, f]) => [k, { ...f, ...(f.clips ? { clips: traversalStates(f.clips) } : {}) }])) : P.figures;
  // (each grant over the rule as it stands: a high jump the hero's own half as high again, a second jump at least one)
  const grant = (rule) => grants.reduce((r, m) => { const g = TRAVERSAL_MOVES[m.move ?? m].rule(r, m); return { ...r, ...g, ...(g.airJumps ? { airJumps: Math.max(r.airJumps ?? 0, g.airJumps) } : {}) }; }, rule);
  return { ...P, figures, entities: P.entities.map((e, i) => (i === 0 ? { ...e, rule: grant({ ...e.rule, ...(moves ?? {}) }) } : e)) };
}
// a hero runs and walks with Z held (player.js HERO_WALK_RUN); a mascot pilot runs on its own clips, and a hero with the
// gear (the swing and zip) runs as it did
const walkRun = (pilot, extra = '') => (pilot || /\bF\s/.test(extra ?? '') ? 'W / S  run' : HERO_WALK_RUN);
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
  const powers = pk.length ? Object.fromEntries(pk.filter((p) => p.move).map((p) => [p.id, TRAVERSAL_MOVES[p.move].rule({ jumpSpeed: CITY_HERO.rule.jumpSpeed }, { ...p, ...vayoTune(G, p.move) })])) : null;
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
  // (a duel's player starts in lane one: its grid's second slot, lane two's the rival's)
  const T = trackContract(plan), surface = trackSurface(plan), pole = T.duel ? T.duel.grid[1] : T.grid[0];
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
// a stage's climbs (local-meru's climb sites: a tower's ladder, drawn by the meru as a stand-in) as the climbable
// surfaces playscape's ladder lowers: { anchor, p, S } each, the ladder's params and its surface (kept by manifest)
const CLIMBS = new Map();
function climbsOf(manifest) {
  const key = JSON.stringify(manifest);
  if (!CLIMBS.has(key)) {
    if (CLIMBS.size >= ENDS_KEPT) CLIMBS.delete(CLIMBS.keys().next().value);
    const sites = (assembleStageScene(manifest).anchors ?? []).filter((a) => a.kind === 'site' && a.site === 'climb' && Array.isArray(a.from) && Array.isArray(a.to));
    CLIMBS.set(key, sites.map((a) => {
      const p = ladderParams({ variant: LADDER_VARIANTS[a.link?.prefer] ? a.link.prefer : 'ladder', from: a.from, to: a.to, facing: a.N });
      return { anchor: a, p, S: climbSurface(p) };
    }));
  }
  return CLIMBS.get(key);
}

/**
 * A stage's climbs as the hero climbs them: the climbable entity playscape's ladder lowers for each climb site, so the
 * platform rule takes hold of the ladder the meru draws and mounts the tier above it (before this, the drawn ladder was
 * no surface, and a climb's top was out of the hero's reach). [] for a stage with no climb: its level as it was.
 */
export function climbLadders(manifest) {
  if (!manifest?.meru) return [];
  return climbsOf(manifest).map(({ anchor, p, S }) => LADDER.lower(p, S, `ladder-${anchor.id}`).entities[0]);
}

/**
 * The way up a climb as its builder laid it, for the audit's walk (create-game.js auditGameLevel): its rising sites by
 * height (each flight from its foot to its head), each climbable surface as a CLIMB leg: stood off its foot on the
 * climber's side, then walked into until the climb rule mounts its lip (motion/world-frames.js). The walker steers by
 * x,y, so a walk straight to a climb's top stands under it on a lower tier; this is the route that reaches it.
 * → waypoints ([x, y] | { climb: { face, top, seconds } }), [] when the stage lays no rising site.
 */
export function climbRoute(manifest) {
  if (!manifest?.meru && !manifest?.trail) return [];
  const anchors = assembleStageScene(manifest).anchors ?? [];
  const surfaces = new Map(climbsOf(manifest).map((c) => [c.anchor.id, c]));
  const rising = anchors.filter((a) => a.kind === 'site' && Array.isArray(a.from) && Array.isArray(a.to) && a.to[2] > a.from[2] + 0.2)
    .sort((a, b) => a.from[2] - b.from[2] || (a.s0 ?? 0) - (b.s0 ?? 0));
  const xy = (p) => [r3(p[0]), r3(p[1])];
  return rising.flatMap((x) => {
    const C = x.site === 'climb' ? surfaces.get(x.id) : null;
    if (!C) return [xy(x.from), xy(x.to)];
    // the climber's side is the surface's own (Nh): stand off its foot there, and face back through it
    const { S, p } = C, at = (k) => [S.base[0] + p.Nh[0] * k, S.base[1] + p.Nh[1] * k];
    return [xy(at(0.6)), { climb: { face: xy(at(-1)), top: r3(p.to[2]), seconds: r3(p.rise / (p.speed || 2) + 4) } }];
  });
}

export function stageEnds(manifest) {
  const key = JSON.stringify(manifest);
  if (!ENDS.has(key)) { if (ENDS.size >= ENDS_KEPT) ENDS.delete(ENDS.keys().next().value); ENDS.set(key, manifest.kind === 'geocube' && manifest.show === 'geotown' ? geotownEnds(manifest) : readEnds(manifest)); }
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
  // the town's houses as they stand (stage-buildings.js `town-<use>-<n>`): each door, the way it faces out and, walked
  // into, its rooms; where the folk stand (folk-cast.js). Not data either: a house the street had no frontage for is
  // not here
  const townDoors = anchors.filter((a) => (a.kind === 'house' || a.kind === 'building') && /^(house|building)-town-/.test(a.id) && Array.isArray(a.at) && Array.isArray(a.N))
    .map((a) => ({ id: a.id.replace(/^(house|building)-/, ''), use: a.use, at: a.at, N: a.N, enter: a.enter ?? null, ...(Array.isArray(a.rooms) ? { rooms: a.rooms } : {}) }));
  Object.defineProperty(out, 'townDoors', { value: townDoors, enumerable: false });
  return out;
}

// THE TOWN'S ENDS (a geotown level, geotown/scene.js): the hero set down at the start of the walk round its first block,
// facing along it, its exit the far side of that walk; beats along the way every dozen metres; its ground the town's
// ground faces (its streets, walks, yards, squares: never a roof), what stands on it its houses' and sites' boxes
const TOWN_GROUND = new RegExp(`^geotown:(${GEOTOWN_SURFACES.filter((k) => k !== 'house').join('|')})$`);
function geotownEnds(manifest) {
  const own = Object.fromEntries(Object.entries(manifest).filter(([k]) => GEOTOWN_KEYS.includes(k))), P = assembleGeotownScene(own, {});
  const route = (P.route ?? []).map((p) => [p[0], p[1], p[2] ?? 0]);
  if (route.length < 2) throw new Error('levels: the town lays no walk round its first block to set the hero down on');
  const ground = groundSampler(P.faces ?? [], TOWN_GROUND), on = (p) => { const z = ground(p[0], p[1]); return [r3(p[0]), r3(p[1]), r3(z ?? p[2])]; };
  const spawn = on(route[0]), far = route.reduce((m, p, i) => (Math.hypot(p[0] - spawn[0], p[1] - spawn[1]) > Math.hypot(route[m][0] - spawn[0], route[m][1] - spawn[1]) ? i : m), 0);
  const exit = on(route[far]), heading = r3(Math.atan2(route[1][1] - route[0][1], route[1][0] - route[0][0]));
  const beats = [];
  let last = route[0];
  for (const p of route.slice(1, far)) if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 12) { beats.push({ beat: 'along', at: on(p) }); last = p; }
  const doors = geotownDoors(P, manifest.enter ?? [], route, ground, manifest.seed ?? 1);
  const out = { spawn, heading, exit, exitFrom: 'the far side of the walk round its first block', planar: true, beats, hazards: [], via: route.slice(0, far + 1).map((p) => [r3(p[0]), r3(p[1])]), ...(doors.length ? { doors } : {}) };
  Object.defineProperty(out, 'ground', { value: ground, enumerable: false });
  Object.defineProperty(out, 'surface', { value: ground, enumerable: false });
  Object.defineProperty(out, 'rocks', { value: () => null, enumerable: false });
  Object.defineProperty(out, 'colliders', { value: P.colliders ?? [], enumerable: false });
  Object.defineProperty(out, 'townDoors', { value: [], enumerable: false });
  return out;
}

// THE TOWN'S DOORS: for each use the level opens (`enter`), the house of that use whose door stands nearest the walk the
// hero is set down on, entered at its door into a scene of its own (interiorStage): its zone on the walk before the door,
// where a walker coming back out stands a few steps out, facing away from it
function geotownDoors(P, enter, route, ground, seed) {
  const houses = (P.anchors ?? []).filter((a) => a.kind === 'house' && Array.isArray(a.at) && Array.isArray(a.N));
  const off = (p) => { let m = Infinity; for (let i = 1; i < route.length; i++) { const a = route[i - 1], b = route[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); m = Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)); } return m; };
  const taken = new Set(), doors = [];
  for (const use of enter) {
    const h = houses.filter((a) => a.use === use && !taken.has(a.id)).map((a) => ({ a, d: off(a.at) })).sort((x, y) => x.d - y.d || (x.a.id < y.a.id ? -1 : 1))[0]?.a;
    if (!h) continue;
    taken.add(h.id);
    const [nx, ny] = h.N, zone = [h.at[0] + nx * 0.7, h.at[1] + ny * 0.7], back = [h.at[0] + nx * 2.6, h.at[1] + ny * 2.6], gz = (p) => ground(p[0], p[1]) ?? h.floor;
    const id = h.id.replace(/^house-/, '');
    doors.push({ id, at: [r3(zone[0]), r3(zone[1]), r3(h.floor)], half: Math.abs(nx) > Math.abs(ny) ? [0.75, 1.4, 2] : [1.4, 0.75, 2], spawn: [r3(back[0]), r3(back[1]), r3(gz(back))], heading: r3(Math.atan2(ny, nx)),
      inside: { use, seed: seed + doors.length + 1 } });
  }
  return doors;
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
// a walked stage's climbs laid as the surfaces the hero climbs (climbLadders): after its other entities; a stage with no
// climb, and a city, a building or its inside (which lay their own ways up), as they were
const LAYS_OWN = new Set(['city', 'building', 'interior']);
function withClimbs(stage, L) {
  const m = L?.args?.manifest;
  // (a climb site is a local meru's: a trail, a roadway, an airspace or a run lays none, and is not asked)
  if (LAYS_OWN.has(stage.section) || !stage.manifest?.meru || !Array.isArray(m?.entities)) return L;
  const ladders = climbLadders(stage.manifest);
  return ladders.length ? { ...L, args: { ...L.args, manifest: { ...m, entities: [...m.entities, ...ladders] } } } : L;
}

export function stageLevelOrder(G, stage, opts = {}) {
  const laid0 = withClimbs(stage, levelOrder(G, stage, opts));
  // a stage the style's hour does not reach (gameStages `unlit`): advice, never a refusal
  const laid = stage.unlit === undefined ? laid0 : { ...laid0, laws: [...(laid0.laws ?? []), { concern: 'hour', law: 'lit', holds: false, says: `style.hour '${stage.unlit}' lights a stage the level's geocube paints; this ${stage.section} stage is not on one, so it is lit as before` }] };
  const L = opts.moves ? withOwnMoves(laid, opts.moves) : laid;
  // the screen the game is made for (game/screen.js): each level holds its frame. Absent: no key, every print as it was
  const S = G.screen ? screenLevel(G.screen, L) : L;
  // a game played in a headset (scene/channels/xr.js): each level's page opens a session that plays it. Absent: no key
  return G.xr ? { ...S, args: { ...S.args, manifest: { ...S.args.manifest, xr: G.xr } } } : S;
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

/** THE BOOK'S UI DIRECTION on every level that plays (its HUD, its menus, its party battles): the systems page's own
 * where it writes one, else proposed from one seed of the world's, so all of a game's levels roll the same guide (its
 * register, its tokens, its border) rather than each its own; 'auto' and a stored direction as the book has them. */
function withBookUi(G, play) {
  if (!play || typeof play !== 'object') return play;
  const u = play.ui === undefined ? G.mechanics?.ui ?? 'propose' : play.ui;
  if (u !== 'propose') return u === play.ui ? play : { ...play, ui: u };
  let h = 2166136261;
  for (const c of `${G.id}:${G.seed ?? 1}:ui`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return { ...play, ui: { seed: h % 2147483647 } };
}

function levelOrder(G, stage, { ref, heroRef, heroGaits = null, pilot = null, mechanics = null, title, goal, map = null, story = null, carryFrom = null, party = null, castFigures = null, guards = null, audio = null, ride = null, extra = null, legend = null, goalCast = null, cityRefs = {} } = {}) {
  // a building level, or the inside of a building entered by its door: laid from its program (buildingLevelOrder)
  if (stage.section === 'city') return cityLevelOrder(G, stage, { title, map, cityRefs, heroRef, heroGaits });
  if (stage.section === 'building' || stage.section === 'interior') return buildingLevelOrder(G, stage, { ref, heroRef, heroGaits, pilot, mechanics, title, goal: stage.section === 'interior' ? null : goal, goalCast: stage.section === 'interior' ? null : goalCast, extra, legend, story, carryFrom, party, castFigures });
  const ends = stage.section === 'roadway' ? roadwayEnds(stage.manifest) : stage.section === 'airspace' ? airspaceEnds(stage.manifest) : stage.section === 'runner' ? runnerEnds() : stageEnds(stage.manifest);
  // what game it is (intent.js): the stage's share of its concerns (lay-concerns.js), on its anchors before any goal
  // reads them: the field the ground was flattened for, a race's checkpoint spacing; cover stands after the goal's cast
  const concerns = concernIds(cubeOfWorld(G).cube);
  // (set on every call, null when absent: a stage's anchors may be a cached object another stage read before)
  Object.defineProperty(ends, 'field', { value: stage.field ?? null, enumerable: false, configurable: true });
  // the level's platforming COURSE on this trail (course.js): floors and gaps sized by the hero's reach; its floors are the
  // stage's beats from here on, so what stands on the stage (foes, packs, pickups) stands on them, not under them
  const courseSpec = stage.manifest.trail !== undefined ? courseAt(G.levels[stage.level]?.course ? readCourse(G.levels[stage.level].course, 'course') : null, stage.node) : null;
  const course = courseSpec ? (() => {
    const lane = stageLane(stage), reach = reachOf(G.feel ? readFeel(G.feel) : null), length = lane.line.length - 1;
    const plan = coursePlan(reach, { teach: courseSpec.teach, verticality: courseSpec.verticality ?? 'flat', length });
    const L = lowerCourse(plan, lane), at = (s, z) => { const i = Math.min(lane.line.length - 1, Math.max(0, Math.round(s))); return [lane.line[i][0], lane.line[i][1], r3(L.base + z)]; };
    return { plan, lowered: L, laws: courseLaws(plan, reach), beats: plan.floors.map((f, k) => ({ beat: `floor-${k + 1}`, at: at((f.s0 + f.s1) / 2, f.z) })) };
  })() : null;
  if (course) ends.beats = [...(ends.beats ?? []).filter((b) => b.beat === 'trailhead'), ...course.beats, ...(ends.beats ?? []).filter((b) => b.beat === 'exit')];
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
  if (STEERED[cam] && !heroRef) throw new Error(`levels: a ${cam} camera chases a hero; give the world a hero, or play it first-person`);
  const look = cam === 'first-person', top = cam === 'top-down', lane = cam === 'side' ? stageLane(stage) : null;
  // (a 3D platformer's chase, cameras.js STEERED: the hero moves the way the camera looks; orbit's look is the player's)
  const steered = STEERED[cam] ?? null;
  // what the goal stands beside the pilot (EXTRA, below), read first: a shooter over the shoulder is a hero the mouse
  // turns, as in first person (quick.js SHOULDER `mouseLook`); so is a hero carrying a gun (armedPilot). From the eye, a
  // pilot with a quick knife (arms-kit.js) cuts on V (the page's gunplay view reads it; the chase camera's V is its own)
  const X0 = extra ? extra(ends) : goalCast ? goalCast(ends) : null;
  const shoulder = !!heroRef && !look && (cam ?? 'third-person') === 'third-person' && !!(X0?.camera?.mouseLook || shotItem(G));
  const moveWords = stage.section === 'runner' ? 'A / D  change lane · S  slide' : lane ? 'A / D  run' : steered ? `W A S D  move${steered === 'orbit' ? ' · drag / right stick  look' : ''}` : top ? `W A S D  move${heroRef && !pilot && !heroMoves(G)?.gear ? ' · Z  walk' : ''}` : look || shoulder ? `${heroRef ? walkRun(pilot, heroMoves(G)?.gear ? 'F ' : legend) : 'W / S  walk'} · A / D  step aside · mouse  look` : `${heroRef ? walkRun(pilot, heroMoves(G)?.gear ? 'F ' : legend) : 'W / S  walk'} · A / D  turn`;
  const controls = `${moveWords}${heroRef ? ' · Space  jump' : ''}${heroRef && carriesStrike(G) ? ` · ${STRIKE_LEGEND}` : ''}${heroRef && shotItem(G) ? ` · ${FIRE_LEGEND}` : ''}${legend ? ` · ${legend}` : ''}${look && X0?.pilot?.rule?.knife ? ' · V  knife' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
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
    // THE RIDE (ride.js): the hero is a vehicle, on the drive rule its build derived, followed from behind (a ride's own
    // chase when it brings one: a realistic loft's, scaled to its length); or a racer
    // (quick.racers): the first of the field, in the machine its driver reads as, followed close (a kart is small)
    const P = playerWorld({ heroRef: 'none', id: 'car', title: name, controls: `W  throttle · S  brake, hold to reverse · A / D  steer${mechanics?.legend ? ` · ${mechanics.legend}` : ''}` });
    pilotPart = {
      figures: { ride: ride.figure ?? (ride.racer ? { racer: ride.racer } : { vehicleRef: ride.ref, targetH: RIDE_H }) },
      entities: [{ id: 'car', pilotable: true, rule: ride.rule, body: { type: 'figure-rig', figure: 'ride' }, transform: { pos: ends.spawn, heading: ends.heading } }],
      camera: ride.camera ? { rule: 'follow', target: 'car', ...ride.camera } : ride.racer ? { rule: 'follow', target: 'car', ...RACER_CAMERA } : ride.figure ? { rule: 'follow', target: 'car', ...SUPERCAR_CAMERA } : { rule: 'follow', target: 'car', dist: 11, height: 4.5, lead: 5, lookH: 1.2 },
      events: P.events || {},
    };
  } else if (heroRef) {
    // first person rides the hero's eye in look mode, its body hidden; top-down moves it in the screen's frame
    const camRule = look || shoulder ? { turnMode: 'look' } : top ? { move: 'world', moveYaw: OVERHEAD.yaw } : lane ? { move: 'lane', lane: lane.line } : steered ? { move: 'camera' } : undefined;
    // the world's feel (feel/lower.js): its template's card lowered over the hero's platform rule, the camera's way of
    // moving kept; no feel, the hero's own rule as it was
    const written = G.feel ? feelRule(G.feel) : null;
    const rule0 = written ? { ...written, ...(camRule ?? {}) } : camRule, struck = strikeWindow(G, rule0);
    // (a feel that asks for its takes: the hero plays its own jumps on the rule's flight, feel/lower.js TAKES)
    const takes = G.feel && readFeel(G.feel).takes ? TAKES : null;
    const rule = struck ? { ...(rule0 ?? {}), ...struck } : rule0;
    // (a mascot pilot, egocube/mascot-pilot.js: its own clips, capsule, stride, camera and eye)
    const moves = heroMoves(G);
    const P = withMoves(playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), ...(lane || stage.section === 'runner' ? { walk: false } : {}), id: 'hero', title: name, controls: `${controls}${written?.dash ? ' · F  dash' : ''}${written?.sprintSpeed ? ' · Shift  sprint' : ''}${movesLegend(moves)}`, ...(rule ? { rule } : {}), ...(takes ? { takes } : {}) }), moves, startingGrants(G));
    const events = { ...(P.events || {}), ...(mechanics?.inputs?.length ? { inputs: [...(P.events?.inputs ?? []), ...mechanics.inputs] } : {}) };
    const camera = look ? { rule: 'eye', target: 'hero', height: pilot ? pilot.eye : HERO_EYE, mouseLook: true, hideTarget: true }
      : top ? { rule: 'overhead', target: 'hero', ...OVERHEAD }
        : lane ? { rule: 'side', target: 'hero' }
        : cam === 'fixed' ? { rule: 'fixed', target: 'hero', stations: fixedStations(ends) }
        : steered ? { ...P.camera, steer: steered }
        : stage.section === 'runner' ? { rule: 'follow', target: 'hero', ...RUNNER_CAMERA }
        : P.camera;
    const A = armedPilot(G, { ...P.entities[0], transform: { pos: ends.spawn, heading: ends.heading } }, cam);
    pilotPart = { figures: P.figures, entities: [A.entity], camera: cam && cam !== 'third-person' ? camera : A.camera ?? camera, events };
    seatable = !look;
  } else {
    // FIRST PERSON: no hero; you are the camera, a walker held at the stage's own eye height (with a body the walls of
    // the stage's buildings stop, when it has any). Asked for by name, it looks with the mouse (yaw and pitch) through
    // an `eye` camera; unnamed, it keeps the old tank-turn walker.
    // (a feel written: the platform rule its card is lowered onto, at the eye, so a hero-less first person runs, gathers,
    // jumps and stops as its card says; a person's walk, so F is no thrust and Z walks. No feel: the walker, as it was)
    const felt = G.feel ? feelRule(G.feel) : null;
    const P = playerWorld({ heroRef: 'none', id: 'player', title: name, controls: felt ? `${controls} · Space  jump${felt.sprintSpeed ? ' · Shift  sprint' : ''}` : controls });   // for its legend only: no figure is kept
    // (a building on storeys: it looks for its ground over its feet, so it climbs the treads, never onto the floor above)
    const rule = felt
      ? { type: 'platform', speed: 4.5, walkSpeed: 1.6, turn: 2.4, eye: EYE_FALLBACK, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...felt, ...(look ? { turnMode: 'look', lookPitch: true, strafe: 1 } : {}) }
      : { type: 'walk', speed: 4.5, turn: 2.4, eye: EYE_FALLBACK, ...(look ? { turnMode: 'look', lookPitch: true, strafe: 1 } : {}), ...(stage.manifest.buildings ? { collideRadius: 0.3 } : {}), ...(ends.storeyed ? { probe: PROBE } : {}) };
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
    // (each a GUARD, stood as every hostile is: foes.js standFoe, its narrow sweeping gaze the class's; the sneak's own:
    // watchers, never fought, a short way from their posts)
    const part = { figures, entities };
    for (const [k, g] of watchers.entries()) {
      // (a pool of guards' figures, each its own roll, cycled: quick.js refAt)
      const figure = libraryFigure(Array.isArray(guards.ref) ? guards.ref[k % guards.ref.length] : guards.ref);
      standFoe(G, part, { id: g.id, entry: SNEAK_GUARD, at: lane ? onLane({ at: g.at }, lane).at : g.at, heading: g.heading }, { figure, tune: SNEAK_TUNE });
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
  const X = X0;
  if (X) {
    const p0 = pilotPart.entities[0];
    // (a written feel wins over a goal's own feet: a deathmatch's shooter pole moves the pilot only where no feel is written)
    const feelOver = X.pilot?.rule && G.feel ? feelRule(G.feel) : null;
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
  // the course's floors and stairs, and its catch zones (a fall into a gap: back on the floor it left)
  if (course) {
    blocks = [...(blocks ?? []), ...course.lowered.blocks];
    const ev = pilotPart.events ?? {}, C = course.lowered.events;
    pilotPart = { ...pilotPart, events: { ...ev, sources: [...(ev.sources ?? []), ...C.sources], reactions: [...(ev.reactions ?? []), ...C.reactions] } };
  }
  if (ways && ways.arrive.length) {
    const pilot = pilotPart.entities[0].id, ev = pilotPart.events || {};
    const moves = ways.arrive.map((a) => ({ on: `arrive:${a.from}`, do: 'move', target: pilot, to: lane ? onLane({ at: a.at }, lane).at : a.at }));
    pilotPart = { ...pilotPart, events: { ...ev, reactions: [...(Array.isArray(ev.reactions) ? ev.reactions : []), ...moves] } };
  }
  // POWER KEYS (a map world): every stage hears what the hero holds, and a held power with a move changes the hero's rule
  const pk = map ? powerKeys(G) : [], later = heroRef ? laterGrants(G) : [];
  if (pk.length || later.length) {
    if (pk.length) game.consumes = [{ slice: 'powers' }];
    const base = heroRef ? pilotPart.entities[0].rule : null;
    const grants = Object.fromEntries(base ? [...pk, ...later].filter((p) => p.move).map((p) => [p.id, TRAVERSAL_MOVES[p.move].rule(base, { ...p, ...vayoTune(G, p.move) })]) : []);
    if (Object.keys(grants).length) game.powers = { ...(pk.length ? { slice: 'powers' } : {}), target: pilotPart.entities[0].id, grants, ...(later.length ? { bought: HOLDER } : {}) };
    // a power that gives the wall or the line: the pilot's figure plays their states' fallbacks from the start
    if (Object.values(grants).some((g) => g.wall || g.gear) && pilotPart.figures) pilotPart = { ...pilotPart, figures: Object.fromEntries(Object.entries(pilotPart.figures).map(([k, f]) => [k, f && f.clips ? { ...f, clips: traversalStates(f.clips) } : f])) };
  }
  let play;
  ({ pilotPart, play } = storyPart(G, stage, ends, lane, pilotPart, extraPlay ? mergePlay(mechanics?.play ?? {}, extraPlay) : mechanics?.play ?? null, { story, carryFrom, party, castFigures }));
  play = withBookUi(G, play);
  const manifest = { ...stage.manifest, title: name, ...pilotPart, ...(play ? { play } : {}), ...(blocks ? { blocks } : {}), ...(mechanics?.destruction ? { destruction: mechanics.destruction } : {}), ...(mechanics?.scars ? { scars: mechanics.scars } : {}), ...(audio ? { audio } : {}), ...(G.style?.pixel ? { pixel: G.style.pixel } : {}), ...juiceOf(G), ...tempoOf(G), ...gradeOf(G), ...(seats ? { seats } : {}), ...(G.mounts ? { mounts: G.mounts } : {}), game };
  // the concerns' laws over what was laid (lay-concerns.js): advisory, for the run's readout
  // a roadway's laws are its own (its census: roads/track.js trackLaws); a trail's, its concerns'
  const laws = stage.section === 'roadway' ? ends.roadLaws : stage.section === 'airspace' ? ends.airLaws : stage.section === 'runner' ? [] : concerns.length ? concernLaws(concerns, { ends, blocks: blocks ?? [], posts: posts ?? [], watchers: watched ?? [], pads: pads ?? [], raised, jump, mechanics: game.mechanics, loop: ends.loop, arena: ends.arena }) : [];
  const allLaws = course ? [...laws, ...course.laws.map((x) => ({ ...x, id: `course:${x.id}` }))] : laws;
  return { tool: 'create_sketch', args: { title: name, manifest }, ends, ...(allLaws.length ? { laws: allLaws } : {}), ...(course ? { course: course.plan } : {}) };
}

/** SEATS (docs/local-multiplayer-principles.md): a world whose cube says soul.seats two or four lays,
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
const PLAY_LISTS = ['cues', 'menus', 'parts', 'spots', 'routines', 'quests'];
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
  const joiners = (party ?? []).filter((p) => p.ref && castFigures?.[p.id] !== null && p.walks !== false), members = [], stands = [];
  // (one who joins but does not walk the map, battles.followers false: in the party for its flag, no figure; and one who
  // joins by the default, on its level, as the level starts: its flag set, said)
  const arrivals = [];
  for (const p of party ?? []) {
    if (p.walks === false && p.joins) members.push({ who: p.id, joins: p.joins });
    // (once the carried flags are in, and only if the member has not joined already: one the story joins earlier, as
    // its quest is given, is not said twice)
    if (p.joinsAt === stage.level && (stage.index ?? 0) === 0 && p.joins) arrivals.push({ id: `party-${p.id}-arrives`, when: { on: FLAGS_READY }, if: [{ var: flagVar(p.joins), eq: 0 }], then: [{ emit: `flag:${p.joins}` }, { say: `${p.name ?? p.id} joins the party`, as: 'toast' }] });
  }
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
  if (arrivals.length) play = { ...(play ?? {}), cues: [...(play?.cues ?? []), ...arrivals] };
  // (a party all with the pilot from the start carries no flag between levels)
  if (members.length) play = { ...(play ?? {}), party: members, ...(stands.length ? { spots: [...(play?.spots ?? []), ...stands] } : {}), ...(members.some((m) => m.joins) ? { carry: STORY_SLICE } : {}) };
  // THE QUESTS (story.js, playscape/ui/quests.js): every stage keeps the journal, its flags carried in the story slice
  // (beside a stage's own: a town's sidequests, folk-cast.js)
  if (G.quests?.length) play = { ...(play ?? {}), quests: [...(play?.quests ?? []), ...levelQuests(G.quests)], carry: STORY_SLICE };
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
  return powers.filter((p) => keyed.has(p.id)).map((p) => ({ id: p.id, move: p.move ?? null, ...(p.element ? { element: p.element } : {}) }));
}

export function mapPlan(G, stages, refs) {
  const plan = stages.map(() => ({ on: [], back: [], keys: [], powers: [] }));
  const isPower = new Set(powerKeys(G).map((p) => p.id));
  // (a building's inside is joined to its outside by its door, levels.js gameStages: no way of the map's)
  const of = (lvl) => stages.map((s, i) => (s.level === lvl && s.section !== 'interior' ? i : -1)).filter((i) => i >= 0);
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
    // (a way the story opens, needs: shut on its page and in the shell until the quest's flag is set)
    plan[last].on.push({ to: refs[first], ...(l.key ? { gate: { has: l.key, slice } } : l.needs ? { gate: { flag: l.needs, slice: STORY_SLICE }, needs: l.needs } : {}) });
    plan[first].back.push({ to: refs[last] });
    if (l.key) { const at = of(l.keyAt); plan[at[at.length - 1]][slice === 'powers' ? 'powers' : 'keys'].push(l.key); }
  }
  // the errands' legs on each level's last stage (errand.js): its trades and bounties, the giver's hand-in, the cargo
  for (const id of G.ids) { const ix = of(id); if (ix.length) plan[ix[ix.length - 1]].errand = errandLegs(G.errands, id); }
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
    mechanics.push({ kind: 'reach-exit', exit: w.id, at: s.at, radius: w === plan.back[0] ? 1.2 : 2.5, ...(ends.planar ? {} : { planar: false }), ...(w.needs ? { needs: w.needs } : {}) });
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
  // the errands' legs (errand.js), each on a beat of its own, past the ways' and the keys'
  if (plan.errand?.length) {
    const free = ends.beats.filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead' && !extra.some((_, j) => side[j] === b));
    const taken = new Set([...extra.map((_, j) => side[j]), ...(found.length ? [free[Math.floor(free.length / 2)]] : [])]);
    const spots = free.filter((b) => !taken.has(b)).map((b) => b.at);
    mechanics.push(...layErrand(plan.errand, spots));
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
  // a world with errands carries what they fetch in the bag (errand.js)
  else if (G.errands?.length) slices.push({ name: 'bag', kind: 'inventory' });
  // a level whose goal collects picks up into the bag (its own goal: quick.js levelGoalMechanics)
  else if (G.ids.some((id) => G.levels[id].goal?.collect)) slices.push({ name: 'bag', kind: 'inventory' });
  if (pk.size) slices.push({ name: 'powers', kind: 'inventory' });
  // the world's scenes read and set flags: a story slice carries them from level to level
  // (and the party's flags the run lays when the book gives none, casting.js laidJoins: a member joining on its level
  // carries the story slice, so the store declares it)
  if (storyCarried(G) || storyCarried(laidCasting(laidJoins(G).G))) slices.push({ name: STORY_SLICE, kind: 'flags' });
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

/** The stage a building level is built as (its program on its kit, in its palette): what a run makes and what the book
 *  shows its finishes from (finishes.js); null for a building by ref, played as it was made. */
export const levelBuildingStage = (G, R, level) => (R.building.ref ? null : R.building.complex ? complexStage(R.building) : inPalette(buildingStage(partyScaled(G, R.building)), R.style?.palette ?? G.style?.palette, `${level}/building`));

/** THE PARTY'S DUNGEON IS LAID LARGER (a principle): a world that fights in party battles on its levels lays its
 * building levels' rooms DUNGEON_SCALE times a walker's, so a party and its foes stand in a room with room to spare and
 * the fight's camera stands back inside it (rpg-channel.js's arena) rather than being cut away to; a building on a
 * core plan (an office, a base) keeps its own, as does a building that writes its rooms' sizes. */
export const DUNGEON_SCALE = 2;
function partyScaled(G, B) {
  const fights = laidBattles(G).battles, shape = PROGRAMS[B.use]?.shape;
  return fights && fights.on !== 'board' && shape && shape !== 'core' && B.look === undefined && !PROGRAMS[B.use]?.base ? { ...B, scale: DUNGEON_SCALE } : B;
}

/** What a world's complex levels advise (network/complex.js complexLaws): each law that does not hold, by level, and
 *  what it measured and wants. A level its world cannot resolve says so elsewhere; here it says nothing. */
export function complexAdvice(world) {
  const out = [];
  for (const [id, L] of Object.entries(world?.levels ?? {})) {
    if (L?.building?.complex === undefined) continue;
    try {
      const R = resolveLevel(world, id);
      for (const l of complexLaws(complexStage(R.building))) if (!l.ok) out.push(`${id}: ${l.law}: ${l.value} (wants ${l.want})`);
    } catch { /* refused where it is read */ }
  }
  return out;
}

/** A complex level's stage recipe (network/complex.js): its buildings on their yard, played from one's front door to
 *  another's goal room through the passages (structure/level.js lowers its `level`). */
export const complexStage = (B) => ({ kind: 'stage', complex: B.complex, level: { from: B.from, to: B.to } });

/** The inside of a building entered by its door: its program on its room kit, played from its door `out` (which
 *  leads back out) to its goal room. */
export function interiorStage(inside) {
  const anchor = typeof inside.civilization === 'string' ? inside.civilization : undefined;
  // (a base's building, or one given a look, is composed as a building level is: its bay kit, its rooms stocked)
  if (PROGRAMS[inside.use]?.base || inside.look !== undefined) {
    const { level: _l, ...S } = buildingStage({ use: inside.use, seed: inside.seed ?? 1, rooms: inside.rooms, add: inside.add, kit: inside.kit, anchor, look: inside.look, tone: inside.tone });
    return { ...S, level: { door: 'out' } };
  }
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
  const { use, seed, rooms, add, kit, geocube, goal, from, anchor, look, tone } = B;
  // (a military base's building is composed, so its rooms are stocked by their uses (era/stocking.js): by the look of the
  // walled-core dungeon's space it is, else by its kit's own register; its space's tone colours it)
  const composed = look || PROGRAMS[use]?.base ? { compose: look ? { construction: look.construction, palette: look.palette } : {} } : {};
  // (a building's use names its bay kit, whatever the world's language, and takes its plan's settings: era/programs.js)
  const plan = Object.fromEntries(['storeys', 'wings', 'loading', 'bays', 'scale'].filter((k) => B[k] !== undefined).map((k) => [k, B[k]]));
  return {
    kind: 'stage',
    ...(geocube !== undefined ? { geocube } : { kit: kit ?? PROGRAMS[use]?.kit ?? roomKitFor(anchor) }),
    program: { use, seed, ...(rooms ? { rooms } : {}), ...(add ? { add } : {}), ...(anchor !== undefined ? { civilization: anchor } : {}), ...plan },
    level: { ...(goal !== undefined ? { goal } : {}), ...(from !== undefined ? { from } : {}) },
    ...composed, ...(tone !== undefined ? { tone } : {}),
  };
}

/**
 * A building level's create_sketch call: the stage laid from its program, with `level` (lowered on every read into
 * its game channel: the goal room, the route through its doorways). With a hero, the hero pilots it from the way in
 * (the stage is metres, as the hero is); without one, the level's own first-person walker. A building by ref is not
 * made here: the game plays it as it was made.
 */
function parkedOf(G, word, rooms) {
  const P = readBuildingParked(word);
  const room = rooms.find((r) => roleOf(r.id) === 'hangar') ?? rooms.reduce((a, r) => (r.w * r.d > a.w * a.d ? r : a));
  const dress = Object.values(G.foes ?? {}).map((f) => f?.skin?.dress).find((d) => d?.colourway);
  const livery = P.livery ?? paintOfDress(dress) ?? camoForSetting({ kit: typeof G.style?.kit === 'string' ? G.style.kit : null }) ?? undefined;
  return parkIn(room, P.vehicles, { seed: Number.isInteger(G.seed) ? G.seed : 1, livery, wear: P.wear });
}

/**
 * A building level's ends, as a trail's are (stageEnds): its way in, the rooms between it and the goal room standing in
 * for a trail's beats, its exit the goal room; `bossAt` (the goal room's floor), `rooms`, `use` and `via` beside them,
 * not data. `lowered`: the stage's level as withBuildingLevel lowers it (else lowered here, for a plan to read its room).
 */
export function buildingEnds(stage, lowered = withBuildingLevel({ ...stage.manifest }, 'ends')) {
  const walker = lowered.entities[0], eye = walker.rule.eye ?? EYE_FALLBACK;
  const spawn = [walker.transform.pos[0], walker.transform.pos[1], r3(walker.transform.pos[2] - eye)], heading = walker.transform.heading;
  // the rooms between the way in and the goal stand in for a trail's beats: a quick goal's pickups lie in them
  // (on storeys, each at its room's floor; a complex's, every building's, its own name before each room's)
  const cx = stage.manifest.complex !== undefined ? complexRoute(stage.manifest) : null;
  const plan = cx ? null : withProgram(stage.manifest), floors = plan?.rooms.some((r) => r.storey) ? new Map(planStage(plan.geocube !== undefined ? withGeocube(plan) : plan).rooms.map((r) => [r.id, r.z0])) : null;
  const rooms0 = cx ? cx.rooms.map((r) => ({ id: `${r.building}/${r.id}`, x: r.box.min[0], y: r.box.min[1], w: r3(r.box.max[0] - r.box.min[0]), d: r3(r.box.max[1] - r.box.min[1]), z: r.box.min[2] }))
    : plan.rooms.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, d: r.d, z: floors ? floors.get(r.id) : 0 }));
  const skip = cx ? new Set([`${cx.from}/lobby`, `${cx.goal.building}/${cx.goal.room}`]) : new Set([plan._program.entry, plan._program.goal]);
  const mid = cx ? r3 : (v) => v, beats = rooms0.filter((r) => !skip.has(r.id)).map((r) => ({ beat: r.id, at: [mid(r.x + r.w / 2), mid(r.y + r.d / 2), r.z] }));
  const ends = { spawn, heading, exit: lowered.game.mechanics.at(-1).at, exitFrom: `the ${stage.building.use}'s goal room`, beats, planar: false };
  // (the goal room's floor, under the exit at the walker's eye: where a level goal's boss stands)
  const exit0 = ends.exit;
  Object.defineProperty(ends, 'bossAt', { value: [exit0[0], exit0[1], r3(exit0[2] - eye)], enumerable: false });
  // its rooms (each its box and floor) and its use, for a stage's extra to stand things in (a minigame's stall)
  Object.defineProperty(ends, 'rooms', { value: rooms0, enumerable: false });
  Object.defineProperty(ends, 'use', { value: stage.building.use, enumerable: false });
  // (its route to the goal room, through the doorways and up the flights: an escape room's keys lie on it, escape.js)
  Object.defineProperty(ends, 'via', { value: lowered.game.mechanics.at(-1).via ?? null, enumerable: false });
  return ends;
}

function buildingLevelOrder(G, stage, { ref, heroRef, heroGaits = null, pilot = null, mechanics = null, title, goal = null, goalCast = null, extra = null, legend = null, story = null, carryFrom = null, party = null, castFigures = null } = {}) {
  const name = title ?? `${G.name ?? G.id} · ${stage.level}`;
  let base = { ...stage.manifest, title: name, ...(mechanics?.play ? { play: mechanics.play } : {}) };
  const lowered = withBuildingLevel(base, ref), walker = lowered.entities[0];
  const ends = buildingEnds(stage, lowered), { spawn, heading } = ends;
  const cx = stage.manifest.complex !== undefined ? complexRoute(stage.manifest) : null;
  const plan = cx ? null : withProgram(stage.manifest);
  // its parked vehicles (building.parked, vehicle-registry/parked.js): in its hangar, else its largest room, painted as its
  // foes' faction dresses, else in its setting's camo, stamped into the level's manifest. Absent ⇒ byte-identical
  if (stage.building?.parked !== undefined) {
    const parked = parkedOf(G, stage.building.parked, ends.rooms);
    if (parked.length) base = { ...base, parked };
  }
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
  // (what it gives whoever walks the rooms, as a trail's extra does: the foes' hits and the hero's stomp, foes.js
  // hostileCast's `pilot`; a written feel's feet over a goal's own)
  const feelOver = X?.pilot?.rule && G.feel ? feelRule(G.feel) : null;
  const piloted = (p) => (X?.pilot ? { ...p, ...X.pilot, rule: { ...p.rule, ...(X.pilot.rule ?? {}), ...(feelOver ?? {}) }, body: { ...p.body, ...(X.pilot.body ?? {}) } } : p);
  if (X?.play) base = { ...base, play: mergePlay(base.play, X.play) };
  if (extra && X?.mechanics?.length) base = { ...base, level: { ...base.level, mechanics: [...(base.level?.mechanics ?? []), ...X.mechanics.filter((m) => !(base.level?.mechanics ?? []).some((x) => x.kind === m.kind && x.slice === m.slice))] } };
  if (!heroRef) {
    if (X?.entities?.length) base = { ...base, figures: { ...(base.figures ?? {}), ...X.figures }, entities: [piloted(walker), ...X.entities], camera: lowered.camera };
    if (X?.inputs?.length) base = { ...base, events: { ...(base.events ?? {}), inputs: [...(base.events?.inputs ?? []), ...X.inputs] } };
    return { tool: 'create_sketch', args: { title: name, manifest: { ...base, ...juiceOf(G), ...tempoOf(G), ...gradeOf(G) } }, ends };
  }
  // a hero with the wall or the line (actions.moves) plays it under its rooms' ceilings, laid as colliders (era/anchors.js)
  const moves = heroMoves(G);
  if (moves) base = { ...base, ceilings: true };
  // the world's camera (cameras.js) over the rooms as over a trail: top-down moves the hero in the screen's frame under
  // the overhead camera, fixed cameras stand over the rooms in order; a side camera has no lane in a building; absent
  // (or third person), the hero's own chase, every arg as it was
  const cam = G.camera ?? null, top = cam === 'top-down';
  if (cam === 'side') throw new Error(`levels: a side camera runs a trail's lane, and '${stage.level}' is a building with none; play it top-down, fixed or third-person`);
  const controls = `${top ? `W A S D  move${!pilot && !moves?.gear ? ' · Z  walk' : ''}` : `${walkRun(pilot, moves?.gear ? 'F ' : '')} · A / D  turn`} · Space  jump${carriesStrike(G) ? ` · ${STRIKE_LEGEND}` : ''}${shotItem(G) ? ` · ${FIRE_LEGEND}` : ''}${movesLegend(moves)}${X?.legend ? ` · ${X.legend}` : ''}${legend ? ` · ${legend}` : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const brule = { ...(top ? { move: 'world', moveYaw: OVERHEAD.yaw } : {}), ...(strikeWindow(G, null) ?? {}) };
  const P = withMoves(playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), id: 'hero', title: name, controls, ...(Object.keys(brule).length ? { rule: brule } : {}) }), moves, startingGrants(G));
  const inputs = [...(P.events?.inputs ?? []), ...(mechanics?.inputs ?? []), ...(X?.inputs ?? [])];
  const events = { ...(P.events || {}), ...(inputs.length > (P.events?.inputs?.length ?? 0) ? { inputs } : {}) };
  const A = armedPilot(G, { ...P.entities[0], transform: { pos: cx ? spawn : steppedIn(plan, spawn, heading), heading } }, cam);
  const camera = top ? { rule: 'overhead', target: 'hero', ...OVERHEAD } : cam === 'fixed' ? { rule: 'fixed', target: 'hero', stations: fixedStations(ends) } : A.camera ?? P.camera;
  const pilot0 = { figures: X?.figures ? { ...P.figures, ...X.figures } : P.figures, entities: [piloted(A.entity), ...(X?.entities ?? [])], camera, events };
  // the story's share (its quests, its party; its moments bind to a building's start and goal), as a stage's
  const play0 = base.play ?? null, { pilotPart, play } = storyPart(G, stage, ends, null, pilot0, play0, { story, carryFrom, party, castFigures });
  const manifest = { ...base, ...pilotPart, ...(play !== play0 ? { play: withBookUi(G, play) } : {}), ...juiceOf(G), ...tempoOf(G), ...gradeOf(G) };
  return { tool: 'create_sketch', args: { title: name, manifest }, ends };
}
