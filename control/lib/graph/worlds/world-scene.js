/**
 * world-scene — the single kind → `assemble*Scene` dispatch seam.
 *
 * A stored sketch manifest is a tiny RECIPE; the full traversable-World geometry is
 * regenerated deterministically by the per-kind assembler. Both the live World route
 * (/api/sketches/[ref]/world → emitThreeWorld) and the .glb export route
 * (/api/sketches/[ref]/model.glb → facesToGlb) resolve the SAME payload here, so the
 * downloadable mesh always matches the rendered World.
 *
 * Per-kind knowledge (assembler, default title, calling convention, walk/fog capability)
 * lives in ONE place: the WORLD_KINDS registry (world-kinds.js) — adding a new world kind
 * is one table row there, and keeps both surfaces in sync. This file owns what is generic
 * across kinds: context normalization, the registry lookup + room fallback, and the opt-in
 * channel layering (ao / repeats / motion / signage / physics / controllable / events /
 * walk / fog / audio) below.
 *
 * `resolveWorldScene` returns `{ payload, kind }` where `payload` is null for any kind
 * with no traversable form (the caller then points the user back at /scene or /svg).
 */

import { readScreen, screenPayload, screenFrame } from '@/lib/graph/game/screen';
import { readRunner } from '@/lib/graph/worlds/controllable/runner';
import { readTempo } from '@/lib/graph/worlds/controllable/world-clock';
import { readGrade } from '@/lib/graph/scene/channels/grade';
import { readDegree, breakablesOf, piecesOf } from '@/lib/graph/playscape/destruct/breakability';
import { standBlocks } from '@/lib/graph/playscape/terrain';
import { readMatterSpec, readTool, readScarsSpec, loadAudit } from '@/lib/graph/rupa/index.js';
import { readPanels } from '@/lib/graph/rupa/panels.js';
import { shellBlocks } from '@/lib/graph/rupa/shell-blocks.js';
import { physicsWind } from '@/lib/graph/rupa/one-wind.js';
import { treeBlocks } from '@/lib/graph/rupa/tree-blocks.js';
import { groundGrid, waterBodies } from '@/lib/graph/rupa/ground-grid.js';
import { groundOfShares } from '@/lib/graph/rupa/look-matter.js';
import { manifestGarment } from '@/lib/graph/polygonizer/figure-outfit';
import { resolveMotionMovers } from '@/lib/graph/worlds/motion-vocabulary';
import { resolveSignage } from '@/lib/signage-chrome';
import { resolveSceneLighting } from '@/lib/graph/scene/scene-css3d';
import { composeVolumeFog } from '@/lib/graph/effects/effects-fog';
import { composeCloudDeck } from '@/lib/graph/effects/effects-clouds';
import { resolveWorldAudio } from '@/lib/graph/beats/beats-world';
import { composeLandscapeRaymarch } from '@/lib/graph/landscape/painted-landscape-raymarch';
import { renderFigureWorldFrames } from '@/lib/graph/polygonizer/figure-render';
import { WORLD_KINDS, ROOM_FALLBACK, resolveWrapTextures } from '@/lib/graph/worlds/world-kinds';
import { bookWorldKind } from '@/lib/graph/views/recipe-book/registry';
import { ensureBookLoaded } from '@/lib/graph/views/recipe-book/loader';
import { collectFaceTextures } from '@/lib/graph/landscape/surface-textures';
import { formRoomMaps } from '@/lib/graph/form/room-form';
import { resamplePlans } from '@/lib/graph/matte-paint/detail';
import { ensureExactKernel } from '@/lib/graph/polygonizer/field-exact';
import { resolveFaceMaterials, weatherRigParts } from '@/lib/graph/materials/procedural-material';
import { FLAT_LIGHT, resolveToon } from '@/lib/graph/polygonizer/vexar';
import { resolveLookSpec, applyLook } from '@/lib/graph/era/look';
import { synthesizeLevel, mergeEventManifests, deriveLevelPlayer } from '@/lib/graph/game/level-synth';
import { lowerPlay } from '@/lib/graph/playscape/ui/direction';
import { readWeather } from '@/lib/graph/weather/weather';
// a clock's four seasons, by climate (weather/weather.js CLIMATES)
const SEASON_CLIMATES = ['spring-blossom', 'temperate', 'autumn', 'alpine'];
import { airCard } from '@/lib/graph/era/air';
import { geocubeContrastOf, geocubeRegisterOf, geocubeStructures, geocubeEraOf, geocubeMatterOf, geocubeTownMatterOf, geocubeWindOf, readGeocube } from '@/lib/graph/era/geocube';
import { lowerWaterworks } from '@/lib/graph/era/water-live';
import { readBiocube } from '@/lib/graph/era/biocube';
import { readHour } from '@/lib/graph/era/geocube-hours';
import { landRead, formPayload, DRESS_DEFAULT, GRASS_CARDS } from '@/lib/graph/form/land-read';
import { floraRead, floraBox, viewHeld, FLORA_HIDES } from '@/lib/graph/form/flora-read';
import { snowBase, readSnow } from '@/lib/graph/era/snow';
import { readDrifts } from '@/lib/graph/form/grass-drifts';
import { tagCreaseRoles } from '@/lib/graph/scene/crease-roles';
import { readCreases } from '@/lib/graph/scene/channels/creases';
import { readCone } from '@/lib/graph/scene/channels/view-cone';
import { readAtmosphere, atmosphereInput, roomAirColour } from '@/lib/graph/scene/channels/atmosphere';
import { readClouds, CLOUDS_OF_WEATHER } from '@/lib/graph/matte-paint/sky';
import { wantsSunShare, readOcclusion, liveLightDefaults } from '@/lib/graph/scene/live-light';
import { readEra, ERAS } from '@/lib/graph/era/eras';
import { seedOfRef } from '@/lib/graph/beats/field-cue';
import { normalizeHud, validateHudStyle, titleThemeFor } from '@/lib/graph/game/hud-widgets';
import { hasTitleWords, localizeHudRows, readTitleLocale } from '@/lib/graph/game/title-words';
import { carveTitles } from '@/lib/graph/game/title-carve';
import { lowerGlyphBodies } from '@/lib/graph/game/glyph-forms';
import { lowerFaunaUnits } from '@/lib/graph/worlds/fauna-units';
import { declaredUnits, metersPerUnitFor } from '@/lib/graph/scene/world-units';
import { optionalPackModule } from '@/lib/graph/content-pack';
import { wieldsFigure, armHeld } from '@/lib/graph/worlds/held-strike';

export { resolveWrapTextures };

// Spatial ("moved through") kinds get first-person traverse on by default; the object-study /
// orbit-only kinds (workbench, vehicle-instance, planetary) are intentionally absent. Derived
// from the registry's per-kind `walk` flags (+ the room fallback), so the /world route's
// `payload.walk || WALK_KINDS.has(kind)` semantics are untouched by the registry refactor.
export const WALK_KINDS = new Set([
  ...Object.keys(WORLD_KINDS).filter((k) => WORLD_KINDS[k].walk),
  ...(ROOM_FALLBACK.walk ? ['room'] : []),
]);

// ── prelit posMap LRU (CACHE, not persistence — same discipline as unit-rig's RIG_CACHE) ──────
// A prelit figure's position→colour map is a pure read of its bound GLB (append-only slot, so
// the path names the content). One entry per bound suit; the arena fleet is 7, so 16 is roomy.
// Loader fns arrive as arguments (they're lazy-imported at the one call site).
const POSMAP_CACHE = new Map();
const POSMAP_CACHE_MAX = 16;
// (a glyph map's far range's own haze over the form's far land, level/far-range.js: a share of the page's fog, and the
// sky's air over its nearest ring to its farthest)
const MAP_HAZE = Object.freeze({ fog: 0.3, air: Object.freeze([0.08, 0.42]) });
function posMapFor(path, readBoundMeshFaces, buildPosMap) {
  let m = POSMAP_CACHE.get(path);
  if (m) { POSMAP_CACHE.delete(path); POSMAP_CACHE.set(path, m); return m; }   // LRU touch
  m = buildPosMap(readBoundMeshFaces(path));
  POSMAP_CACHE.set(path, m);
  if (POSMAP_CACHE.size > POSMAP_CACHE_MAX) POSMAP_CACHE.delete(POSMAP_CACHE.keys().next().value);
  return m;
}

/**
 * resolveWorldScene(sketch) → { payload, kind }
 *
 * Regenerates the traversable-World payload for a stored sketch via its per-kind
 * assembler. `payload` is null when the kind has no World form (the assembleRoomScene
 * fallback returns null for any non-room manifest). Async because the workbench path
 * resolves label-wrap textures (which may render referenced sketches to SVG).
 * `paint: true` (an engine or file export): a read in the form render keeps its surfaces as paint, since the export
 * carries no live light to draw the form render's material by (form/room-form.js).
 */
/** A hero's FACE under the runtime's state names (`clips` each state's clip, `own` the hero's clips by their names): a
 * state's facial track its clip's, the ambient blink over a state whose clip it played over or that has no track of
 * its own (a library's clip). */
export function stateFace(face, own, clips) {
  const of = Object.fromEntries(Object.keys(clips).map((st) => [st, Object.keys(own).find((c) => own[c] === clips[st]) ?? null]));
  const tracks = {}, over = new Set(face.ambientOver || []);
  for (const [st, c] of Object.entries(of)) if (c && face.tracks[c]) tracks[st] = face.tracks[c];
  return { ...face, tracks, ambientOver: Object.keys(clips).filter((st) => !of[st] || !tracks[st] || over.has(of[st])) };
}
/** a body destroyed when it goes down (its `vanish.die` a dismantle, a cleave or a destroy: gameworld/vanish.js), or one
 * that sheds a mode (its `modes`): the page's wreck plays both */
// (a body destroyed in its going, a body with modes, or a summons whose strings may be cut: worlds/controllable/summon.js)
const wrecks = (e) => !!(e && e.body && ((e.body.vanish && ['dismantle', 'cleave', 'destroy'].includes(e.body.vanish.die)) || (Array.isArray(e.body.modes) && e.body.modes.length > 1) || (e.rule && e.rule.summoned && e.rule.summoned.bound)));

/** A hero (or a mascot) as a figure-rig body: the layered kind's packed rig, its clips renamed for the runtime's states. */
/** A world's `seats`, checked against its entities: the bodies seats 2 to 4 take (pilotable, not the pilot, each once),
 * how many may sit (2 to 4, at most one more than the bodies), how they join (drop-in or lobby), what an empty seat's body
 * does (its AI, or held still), the height below which a seated body is brought back, and the lives its falls cost (each
 * seat's own, or one count shared). Throws, teaching. */
export function readSeats(seats, entities, pilot = null) {
  const bad = (m) => new Error(`seats${m}: seats is { bodies: [entity id, …], max?: 2-4, join?: 'drop-in' | 'lobby', drop?: 'ai' | 'pause', floor?: number, lives?: 1-99, pool?: 'own' | 'shared' }, the bodies seats 2 to 4 take`);
  if (!seats || typeof seats !== 'object' || Array.isArray(seats)) throw bad('');
  for (const k of Object.keys(seats)) if (!['bodies', 'max', 'join', 'drop', 'floor', 'lives', 'pool'].includes(k)) throw bad(`.${k} is not a seats key`);
  const list = Array.isArray(entities) ? entities : [], first = pilot ?? list.find((e) => e && e.pilotable)?.id;
  if (!Array.isArray(seats.bodies) || !seats.bodies.length || seats.bodies.length > 3) throw bad('.bodies names one to three bodies');
  seats.bodies.forEach((id, i) => {
    const e = list.find((x) => x && x.id === id);
    if (!e || !e.pilotable) throw bad(`.bodies[${i}] '${id}' is not a pilotable entity of this world`);
    if (id === first) throw bad(`.bodies[${i}] '${id}' is the pilot, seat 1's body`);
    if (seats.bodies.indexOf(id) !== i) throw bad(`.bodies[${i}] '${id}' appears twice`);
  });
  const max = seats.max ?? seats.bodies.length + 1;
  if (!Number.isInteger(max) || max < 2 || max > seats.bodies.length + 1) throw bad(`.max is 2 to ${seats.bodies.length + 1} (one more than the bodies)`);
  if (seats.join !== undefined && !['drop-in', 'lobby'].includes(seats.join)) throw bad('.join is drop-in or lobby');
  if (seats.drop !== undefined && !['ai', 'pause'].includes(seats.drop)) throw bad('.drop is ai or pause');
  if (seats.floor !== undefined && !Number.isFinite(seats.floor)) throw bad('.floor is a height in metres');
  if (seats.lives !== undefined && !(Number.isInteger(seats.lives) && seats.lives >= 1 && seats.lives <= 99)) throw bad('.lives is a whole count, 1 to 99: the falls a seat (or the seats together) may take');
  if (seats.pool !== undefined && !['own', 'shared'].includes(seats.pool)) throw bad('.pool is own (each seat its lives) or shared (one count for all)');
  if (seats.pool !== undefined && seats.lives === undefined) throw bad('.pool shares or splits lives: give lives');
  return { bodies: seats.bodies.slice(), max, ...(seats.join ? { join: seats.join } : {}), ...(seats.drop ? { drop: seats.drop } : {}), ...(seats.floor !== undefined ? { floor: seats.floor } : {}), ...(seats.lives !== undefined ? { lives: seats.lives, pool: seats.pool ?? 'own' } : {}) };
}

/** the moves a figure bakes its own clips for (hero-swing-body.js moveClip, strikeMoveClip, aimClip), and the fighting stances: those
 * of the weapons that show this figure (`r.weapons`' figure: the drawn hero the blade's, the sheathed one the fist's; a
 * lone `moveset` the drawn hero's) */
function movesOf(rule, name) {
  const Ws = Array.isArray(rule.weapons) && rule.weapons.length ? rule.weapons : [{ figure: 'drawn', moveset: rule.moveset }];
  const C = rule.combat || {}, sheathed = !!C.sheathed && name === C.sheathed && name !== C.drawn;
  const mine = Ws.filter((W) => (W.figure === 'sheathed') === sheathed);
  const moves = mine.flatMap((W) => Object.values(W.moveset.moves).filter((m) => m.clip).map((m) => ({ clip: m.clip, ...(m.swing ? { swing: m.swing } : { strike: m.strike }), ...(m.travel ? { travel: m.travel } : {}), ...(m.contact ? { contact: m.contact } : {}), ...(m.air ? { air: true } : {}) })));
  const readies = mine.map((W) => { const first = Object.values(W.moveset.moves)[0]; return { clip: W.moveset.ready ?? 'mv_ready', ...(first && first.strike ? { strike: first.strike } : {}) }; });
  // (the sidearms' aims, on every figure the hero shows: a sidearm is held on the sheathed hero, the blade on its back)
  const aims = [...new Map([...Ws.filter((W) => W.sidearm && W.sidearm.aim).map((W) => [W.sidearm.aim, { clip: W.sidearm.aim, pose: W.sidearm.pose, hand: W.sidearm.hand }]),
    // (and each weapon's guard: its pose while the guard is up, combat-melee.js stepGuard)
    ...Ws.filter((W) => W.guard && W.guard.clip).map((W) => [W.guard.clip, { clip: W.guard.clip, pose: W.guard.pose }])]).values()];
  // (and the arsenal's sword art: how the blades are swung, hero-swing-body.js SWING_STYLES)
  const art = mine.map((W) => W.moveset.art).find(Boolean);
  return { moves, readies, ...(aims.length ? { aims } : {}), ...(art ? { art } : {}) };
}
export async function heroFigure(name, spec, { swing = null, swings = null, hands = false, ride = null, grade = null, takes = null } = {}) {
  let manifest, body;
  // a MODEL made elsewhere (`modelRef`: a sketch a rigged humanoid .glb is bound onto, stood `height` metres): its pack read
  // by scene/rig-import.js, played as a hero's is (worlds/controllable/model-figure.js)
  if (typeof spec.modelRef === 'string') body = await (await import('@/lib/graph/worlds/controllable/model-figure.js')).modelPack(name, spec.modelRef, { height: spec.height ?? null });
  else if (typeof spec.heroRef === 'string') {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const src = SketchRepository.getByRef(spec.heroRef);
    // a hero, or a MASCOT on foot (egocube/mascot-pilot.js: its own walk, run and jump); the same check the minting doors run
    const { heroRefError } = await import('@/lib/graph/worlds/controllable/body-types.js');
    const refused = heroRefError(name, spec.heroRef, src, { walker: spec.walker === true });
    if (refused) throw new Error(refused);
    manifest = src.manifest;
  } else {
    const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
    manifest = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec.hero, { staleScale: true }) });
  }
  // THE PLAY GRADE (figure-grades.js): the same hero baked to the budget a game plays it at, its skeleton, clips and palette
  // the pose grade's; a figure's own `grade` over the world's. A plan made without a hero, or the pose grade: as it is
  const G = spec.grade ?? grade;
  if (manifest && G === 'play' && manifest.hero) {
    const { expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
    manifest = expandLayeredManifest({ ...manifest, plan: undefined, recipe: undefined, hero: { ...manifest.hero, grade: 'play' } });
  }
  // `jumps`: the hero's own jumps a game's takes play (gameworld/feel/lower.js TAKES: hero-jump.js words), compiled onto
  // its rig beside its clips (its recipe's `locomotion`, as its door motion is); a jump it already moves by stays its own.
  // Absent: the hero's clips as minted
  if (manifest && Array.isArray(spec.jumps) && spec.jumps.length && manifest.recipe?.rig) {
    const { motionPlan } = await import('@/lib/graph/polygonizer/hero-motion.js');
    const add = motionPlan(Object.fromEntries(spec.jumps.map((w) => [w, true])));
    manifest = { ...manifest, recipe: { ...manifest.recipe, locomotion: { ...add, ...(manifest.recipe.locomotion || {}) } } };
  }
  // `swing`: the world's game type (its composed juice's flavor), the timing the hero's swing plays at (hero-swing.js);
  // `swings`: the contact window of a body that strikes with what the hero holds (the held strike: its swing directions)
  if (!body) {
    // `hands`: a world a headset plays: the hero's hands as the headset draws them ride the pack (hero-xr-hands.js)
    // (`takes`: the scenes' takes this figure plays, playscape/ui/scene-takes.js, packed on its rig as clips of their own)
    const scene = await WORLD_KINDS.layered.resolve(manifest, { title: name, ...(swing ? { swing } : {}), ...(swings ? { swings } : {}), ...(hands ? { xrHands: true } : {}), ...(ride ? { ride } : {}), ...(takes ? { takes } : {}) });
    body = scene.figures && scene.figures.body;
    if (!body) throw new Error(`figures.${name}: the hero has no rig with clips to play`);
  }
  const { preview, embodies, held, ...pack } = body;
  const clips = { ...pack.clips };
  // a LIBRARY (figures/library: an outside animation library's clips, retargeted onto this rig through the T-pose mold):
  // a state's clip the hero lacks is taken from it, once per clip, under the library's own name
  const lib = spec.library ? await (await import('@/lib/graph/figures/library/index.js')).loadClipLibrary(spec.library) : null;
  const { retargetClip } = lib ? await import('@/lib/graph/figures/clip-library.js') : {};
  const { clipLoops } = lib ? await import('@/lib/graph/figures/library/index.js') : {};
  for (const [state, clip] of Object.entries(spec.clips || {})) {
    if (!clips[clip] && lib && lib.clips[clip]) clips[clip] = retargetClip(pack, lib.clips[clip], { once: !clipLoops(clip) });
    if (!clips[clip]) throw new Error(`figures.${name}: clips.${state} names '${clip}', which the hero does not have (it has ${Object.keys(pack.clips).join(', ')}${lib ? `; the ${lib.id} library has ${Object.keys(lib.clips).join(', ')}` : ''})`);
    clips[state] = clips[clip];
  }
  // its OWN MOVES (`moves`: state → a clip of its own, egocube/moves.js `fieldStatesOf`): a state plays the hero's own
  // clip when it has it, over the library's; one it lacks keeps what the state played (absent ⇒ the same figure)
  for (const [state, clip] of Object.entries(spec.moves || {})) if (pack.clips[clip]) clips[state] = pack.clips[clip];
  // (its FACE, the realistic hero's: each state's facial track the clip's it plays, the ambient blink over a state its
  // clip let it play over; a library's clip has no track and takes the ambient blink)
  const face = pack.face?.tracks ? stateFace(pack.face, pack.clips, clips) : null;
  return { ...pack, clips, ...(held ? { held } : {}), ...(face ? { face } : {}) };
}

/**
 * A level's sketch as it is played: a city segment's level reads its city by ref (city/plan/ref.js), merged before it is
 * lowered as a level, and a city's sites read the edifices they stand by ref the same way; a building that asks to be a
 * level (`level: { goal }`, structure/level.js) has its game channel, walker, camera and colliders lowered from the
 * building on every read. Any other sketch is returned as it is. resolveWorldScene reads every world through it, and the
 * engine handoff its level record (scene/handoff.js), so the page, the game and the handoff read one level.
 */
export async function levelSketch(sketch) {
  if (sketch.manifest?.kind === 'city' && (typeof sketch.manifest.city === 'string' || (sketch.manifest.sites || []).some((x) => x && typeof x.from === 'string'))) {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const { withCityRef } = await import('@/lib/graph/city/plan/ref.js');
    sketch = { ...sketch, manifest: withCityRef(sketch.manifest, (r) => SketchRepository.getByRef(r)?.manifest) };
  }
  if (sketch.manifest?.level && typeof sketch.manifest.level === 'object' && !sketch.manifest.game) {
    const { withBuildingLevel } = await import('@/lib/graph/structure/level.js');
    sketch = { ...sketch, manifest: withBuildingLevel(sketch.manifest, sketch.ref) };
  }
  return sketch;
}

export async function resolveWorldScene(sketch, viewOpts = {}) {
  // field-exact: an `exact: true` field composes through Manifold, which loads asynchronously;
  // the lowering below is synchronous, so the kernel is readied here once (a no-op after).
  await ensureExactKernel();
  // mapRef (map-ref.js): a controllable LEVEL manifest may inherit its terrain from a stored map
  // world instead of carrying a clone of it — the world twin of the figures-map `unitRef` (a game's
  // mode-variant levels share one map row; see mobile-suit/arena-modes.js). Resolved FIRST so every
  // channel below reads the merged manifest. Absent `mapRef` ⇒ byte-identical.
  if (sketch.manifest?.kind === 'controllable' && typeof sketch.manifest.mapRef === 'string') {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const src = SketchRepository.getByRef(sketch.manifest.mapRef);
    if (!src || src.manifest?.kind !== 'controllable') {
      throw new Error(`mapRef '${sketch.manifest.mapRef}' is not a stored controllable world — mint the map first`);
    }
    const { applyMapRef } = await import('@/lib/graph/worlds/map-ref.js');
    sketch = { ...sketch, manifest: applyMapRef(sketch.manifest, src.manifest) };
  }

  // a PERSONA (persona/persona.js) is played as its hero, its reads the hero's face takes where the hero has the realistic
  // face (persona/bundle.js personaHero): the hero's World and its GLB's face:<read> clips, from the persona's scripts
  if (sketch.manifest?.kind === 'persona') {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const hero = SketchRepository.getByRef(sketch.manifest.persona?.hero);
    if (!hero?.manifest?.hero) throw new Error(`persona '${sketch.ref}': its hero '${sketch.manifest.persona?.hero}' is not a stored hero (create_character { as: 'hero' })`);
    const { personaHero } = await import('@/lib/graph/persona/bundle.js');
    sketch = { ...sketch, manifest: personaHero(sketch.manifest.persona, hero.manifest) };
  }

  // a stage drawn in a composed look (a gameworld's look words or palette) carries the recipes that make it: composed here, once per
  // process, before anything reads its kit (color-theorist/look.js). Absent `looks` ⇒ byte-identical.
  if (Array.isArray(sketch.manifest?.looks)) {
    const { ensureLooks } = await import('@/lib/graph/color-theorist/look.js');
    ensureLooks(sketch.manifest.looks);
  }

  // a city segment's city merged in by ref, a building that asks to be a level lowered (levelSketch), before the game
  // channel below reads them
  sketch = await levelSketch(sketch);

  // parked vehicles (`parked`: [{ vehicle, at, heading?, livery?, wear?, seed? }], vehicle-registry/parked.js): each a
  // static loft figure, and a box over its footprint added to whatever colliders the level carries. Opt-in; absent ⇒
  // byte-identical.
  let parkedColliders = [];
  if (sketch.manifest?.parked !== undefined) {
    const { withParked } = await import('@/lib/graph/vehicle-registry/parked.js');
    const P = withParked(sketch.manifest);
    sketch = { ...sketch, manifest: P.manifest };
    parkedColliders = P.colliders;
  }

  // a controllable world's MOUNTS (worlds/mount-units.js readMounts): its horses, read here and laid once its figures are;
  // the solve that teaches its hero to ride them (the hero's pack's hook) kept for them. Absent ⇒ null, byte-identical
  const mountsSpec = sketch.manifest?.kind === 'controllable' && sketch.manifest.mounts != null ? (await import('@/lib/graph/worlds/mount-units.js')).readMounts(sketch.manifest.mounts) : null;
  let mountRide = null;

  // declarative scene lighting — same normalization the /scene route uses.
  const scene = sketch.manifest.scene && typeof sketch.manifest.scene === 'object' ? sketch.manifest.scene : {};
  const time = sketch.manifest.time ?? scene.time;
  const sky = sketch.manifest.sky ?? scene.sky;
  // opt-in per-building ground shadows (off unless the manifest asks). `true` for the default
  // look, or an object `{ strength, length, maxAlpha, max }` to tune the cast.
  const groundShadows = sketch.manifest.groundShadows ?? scene.groundShadows ?? false;
  // toon dial (toon-shading): `toon: true | { bands, ink, bake }` on the manifest (or scene.toon).
  // `bands` quantizes the baked Lambert term in every assembler that threads `ctx.toon`; `ink`
  // is the World's outline channel (emitThreeWorld reads `payload.toon`); `bake: true` (with ink)
  // additionally bakes the ink pair into the GLB export as real geometry (facesToGlb reads the same
  // `payload.toon` — shader-look phase 3). Absent → null → every byte identical. Dropped under the
  // unshaded export: raw albedo has no tones to band. `light` (the layered kind's character light;
  // `false` opts out) rides the same dial, read for a layered row only.
  const kind = sketch.manifest.kind;
  const toon = resolveToon(sketch.manifest.toon ?? scene.toon, { light: kind === 'layered' });

  // ?livery=<shelf name> (z-series assembler units — the arena hangar's swatch row): repaint
  // the stored unit onto another shelf livery BEFORE assembly. Deterministic (a pure tint
  // remap through the baseline anchors), so the /world HTML cache keys on it like any flag.
  let manifest = sketch.manifest;
  if (viewOpts.livery && kind === 'assembler') {
    // engine→mobile-suit seam: the shelf lives in the content pack — absent, serve the base world.
    // Said once per request, because this one was asked for.
    const livery = await optionalPackModule(() => import('../mobile-suit/z-series-livery.js'),
      'mobile-suit/z-series-livery.js', '?livery');
    if (!livery) console.error('?livery ignored: no livery shelf (the mobile-suit content pack is not installed or failed to load)');
    else {
      try { manifest = livery.reliveryZSeries(manifest, { to: viewOpts.livery }).manifest; }
      catch (err) { console.error('?livery ignored:', err?.message); }
    }
  }

  // UNSHADED (flat-albedo) export mode: resolve the
  // world carrying RAW ALBEDO — no Lambert directional shading, no ambient occlusion, no
  // procedural-material/weathering darkening — as a clean base for external GI baking
  // (Blender). The single mechanism is FLAT_LIGHT (vexar: ambient 1 / diffuse 0 ⇒ litFactor
  // ≡ 1), threaded onto `ctx.light` so object-kind assemblers shade flat; the material / AO /
  // weathering darkening passes below are additionally SKIPPED. Absent `viewOpts.unshaded`
  // (the universal case) ⇒ every guard below is inert and every output byte is identical.
  // a sixth-gen LOOK (era/look.js): `look` on the manifest. A kind that resolves to raw albedo is resolved unshaded so
  // the look can bake its own light into it; any other kind keeps its light and takes the look's air and sky. The
  // stage carries its look as `reference`. Absent `look` ⇒ null ⇒ every guard below is inert, every byte identical.
  const lookSpec = kind !== 'stage' ? resolveLookSpec(sketch.manifest.look) : null;
  const bakeLook = !!lookSpec && viewOpts.unshaded !== true && UNSHADED_LAMBERT_KINDS.has(kind);
  const unshaded = viewOpts.unshaded === true || bakeLook;
  // Registry miss → check the attached recipe book's Door-2 kinds
  // before falling back to the room resolver. The await
  // only runs on a core miss, so every core kind's path is untouched; a book
  // kind's row carries the same { title, resolve } shape as a WORLD_KINDS row.
  let desc = WORLD_KINDS[kind];
  if (!desc) {
    await ensureBookLoaded();
    desc = bookWorldKind(kind) ?? undefined;
  }
  desc = desc ?? ROOM_FALLBACK;
  // LIVE LIGHT ON BY DEFAULT where it pays (scene/live-light.js liveLightDefaults): a hero's level takes the actors'
  // shadows, a world whose cube names the seventh generation actors, the hour's map and occlusion, each the recipe's
  // own where it says; all of it under the tier (`light.tier`, auto by the `screen`). Read before the bake, which
  // writes the sun's share for it. The unshaded export bakes no sun and takes none of it. Neither a hero's level nor
  // gen-7 nor an ask: the recipe's own values, and every byte as it was
  // THE ERA IS THE READ'S (era/eras.js: an era is a render of the same recipe, as the engine is): `era` on the read or
  // the export, the cube's own by default, the recipe never written by it. Absent ⇒ the cube's, every byte as it was
  const era = viewOpts.era !== undefined ? readEra(viewOpts.era) : geocubeEraOf(sketch.manifest);
  // NO FLAT BUILDING POLYGONS (era/solid.js): the recipe's `solid` (stamped at mint on a world that builds), or every
  // world read in the form render; the builders read it from the ctx. Absent and gen-6: the skin as it was
  const solidAsked = sketch.manifest.solid;
  if (solidAsked !== undefined && typeof solidAsked !== 'boolean') throw new Error('solid is true (a building\'s every seen edge has thickness: its roofs slabs, its doorways cut through its walls; era/solid.js) or false');
  const solid = solidAsked === true || ERAS[era]?.surface === 'form';
  const liveL = unshaded ? null : liveLightDefaults(sketch.manifest, {
    era, screen: sketch.manifest.screen != null ? readScreen(sketch.manifest.screen) : null });
  const ctx = {
    title: sketch.title || sketch.manifest.title || desc.title,
    time,
    sky,
    groundShadows,
    view: viewOpts.view,
    render: viewOpts.render,
    ref: sketch.ref,
    // (solid: the builders' thickness, above; only when on, so a ctx without it is as it was)
    ...(solid ? { solid: true } : {}),
    // (form: a read in the form render (gen-7), for the builders that make more of the land for it: the meru island's
    // broken boulders, rims and strewn stones; only when on, so a gen-6 ctx is as it was)
    ...(ERAS[era]?.surface === 'form' ? { form: true } : {}),
    // (formLit: a room under no sun drawn by the form render, its colour and its light baked apart by its palette's solve
    // and its relief lit on the page: era/stage.js, form/room-light.js; a page's read only: the unshaded export bakes none of it, and `paint: true` (an
    // engine or file export, which carries its surfaces as paint until it carries materials) keeps the paint)
    ...(ERAS[era]?.surface === 'form' && (!unshaded || viewOpts.handoff === true) && viewOpts.paint !== true ? { formLit: true } : {}),
    // (the engine handoff, scene/handoff.js: a room's light solved apart from its colour though the read is unshaded, so
    // its surfaces leave as their solved bases and its lamps as lights an engine casts)
    ...(viewOpts.handoff === true ? { handoff: true } : {}),
    // the live /world page (not an export or a still): a kind that meshes itself in the page may skip its bake
    live: !!viewOpts.live,
    // FLAT_LIGHT when unshaded, else undefined → each object-kind assembler falls back to
    // its own default key (WORKBENCH_LIGHT etc.), so the shaded path is byte-identical.
    light: unshaded ? FLAT_LIGHT : viewOpts.light,
    // Kinds that shade their OWN faces (fractal-city) read this to emit RAW ALBEDO for a clean
    // GI bake — plain lighting + FLAT_LIGHT, no baked diffusion/moonlight/shadows.
    unshaded,
    toon: unshaded ? null : toon,
    // CREASES (scene/channels/creases.js): `creases` on the manifest (or scene.creases), the vgl rule as a World pass,
    // or the one the REGISTER of the cube that paints the world asks for (era/colour-register.js: cel, ink-wash, wii),
    // the manifest's own winning (false turns the register's off). A kind whose trees are grown here tags them organic
    // when it is on (fractal-city, city); the payload carries it below. Dropped under the unshaded export, as the other
    // baked shading is. Absent ⇒ null ⇒ every byte identical.
    creases: unshaded ? null : readCreases(sketch.manifest.creases ?? scene.creases ?? geocubeRegisterOf(sketch.manifest) ?? undefined),
    // LIVE LIGHT (scene/live-light.js): a world whose `shadows` ask for actors or the hour has its sun bake write each
    // corner's share of light from the sun (`sunShare`), so an actor's shadow on the page never doubles a baked one.
    // Dropped under the unshaded export (it bakes no sun). Absent ⇒ false ⇒ every byte identical
    liveSun: !!liveL && wantsSunShare(liveL.shadows),
    // OCCLUSION (scene/live-light.js, on the creases' prepass): live contact occlusion; the unshaded base drops it
    occlusion: liveL ? readOcclusion(liveL.occlusion) : null,
    // FACE (the skinned GLB's ask): the anime hero's rig pack carries its face rows (anime-face-rig.js), which the
    // skinned writer turns into morph targets; nothing else reads it, and the World page never asks
    face: viewOpts.face === true,
    // the T-pose export (rest: 'tpose'): the flat figure rebuilds its rest on the T armature; nothing else reads it
    tpose: viewOpts.tpose === true,
  };
  const payload = await desc.resolve(manifest, ctx);
  // the World's ink channel reads it; stills ignore it. A resolver that sets its own `toon` keeps it (the layered kind's
  // character ink — its default outline over the manifest's dial); no other kind sets one, so this is ctx.toon for them.
  // The character light is the resolver's input, baked into the faces, never a page dial: it stays off the payload.
  if (payload && ctx.toon && payload.toon === undefined) { const { light: _light, ...dial } = ctx.toon; if (Object.keys(dial).length) payload.toon = dial; }

  // opt-in RAYMARCH backend for painted-landscape (?render=raymarch): a per-pixel terrain/water/sky
  // render (painted-landscape-raymarch.js) instead of the polygon mesh. emitThreeWorld dispatches a
  // `raymarch` payload to emitRaymarchWorld (same path black-hole-view uses), so we swap the whole
  // payload and return early — the mesh channels (motion/signage/walk/…) don't apply to a shader world.
  if (payload && kind === 'painted-landscape' && viewOpts.render === 'raymarch') {
    try {
      const raymarch = composeLandscapeRaymarch(sketch.manifest);
      return { payload: { raymarch, viewBox: payload.viewBox || { width: 1120, height: 780 }, bg: payload.bg || '#9fb6c8', title: payload.title || ctx.title }, kind };
    } catch {
      // an unsupportable recipe (should not happen — both engines port) falls back to the mesh world.
    }
  }

  // placed room items by ref (floorplan `rooms[i].items[].ref`): the house plans the footprint
  // and emits a placement record; the ref resolves HERE, where the store is — its bound mesh
  // when it has one, else its own World faces (a solid, a workbench piece, another sketch) —
  // and placeItemFaces fits it into the footprint. A ref that places itself (directly or
  // through a chain) refuses, like an unknown one. No itemRefs ⇒ untouched.
  if (payload && Array.isArray(payload.itemRefs)) {
    const recs = payload.itemRefs;
    delete payload.itemRefs;
    const chain = [...(viewOpts._itemChain || []), sketch.ref].filter(Boolean);
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const { latestBoundMesh } = await import('@/lib/graph/scene/mesh-store.js');
    const { placeItemFaces } = await import('@/lib/graph/polygonizer/floorplan-structure');
    for (const rec of recs) {
      const src = SketchRepository.getByRef(rec.ref);
      if (!src) throw new Error(`item '${rec.name}': ref '${rec.ref}' is not a stored sketch`);
      if (chain.includes(src.ref)) throw new Error(`item '${rec.name}': ref '${rec.ref}' places itself (${[...chain, src.ref].join(' → ')})`);
      const bound = latestBoundMesh(src.ref);
      let faces, textures = {};
      if (bound) {
        const { readBoundMeshScene } = await import('@/lib/graph/scene/scene-gltf-read.js');
        ({ faces, textures } = readBoundMeshScene(bound.path, {}));
      } else {
        const inner = await resolveWorldScene(src, { _itemChain: chain, unshaded, ...(viewOpts.era !== undefined ? { era: viewOpts.era } : {}), ...(viewOpts.paint ? { paint: true } : {}) });
        faces = inner.payload?.faces || [];
        textures = inner.payload?.textures || {};
      }
      const placed = placeItemFaces(faces, rec);
      for (const [k, url] of Object.entries(textures || {})) {
        if (!payload.textures?.[k]) (payload.textures ??= {})[k] = url;
      }
      payload.faces = [...(Array.isArray(payload.faces) ? payload.faces : []), ...placed];
    }
  }

  // statue refs (historic/statues.js): a historic city's statue slots name stored statues; the city removed the stand-ins
  // and recorded where each figure stands (metres, its turn, its height). The ref resolves HERE, where the store is: its
  // World faces baked under the city's sun turned into its own frame (`light`), its base dropped, fitted onto the slot's
  // base (fitStatueFaces). A ref that places itself refuses, like an unknown one. No statueRefs ⇒ untouched.
  if (payload && payload.statueRefs) {
    const { unit, light, list } = payload.statueRefs;
    delete payload.statueRefs;
    const chain = [...(viewOpts._itemChain || []), sketch.ref].filter(Boolean);
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const { fitStatueFaces, lightInto, statueTurn } = await import('@/lib/graph/historic/statues.js');
    const { statueWords } = await import('@/lib/graph/statue/expand.js');
    const baked = new Map();   // one resolve per statue and turn
    for (const rec of list) {
      const key = `${rec.ref ?? (rec.hero ? `hero:${JSON.stringify(rec.hero)}` : `form:${rec.form}:${rec.material ?? ''}`)}|${rec.dir}`;
      if (!baked.has(key) && rec.form) {   // a library form (statue/forms.js): no store
        const { statueFormManifest } = await import('@/lib/graph/statue/forms.js');
        const inner = await resolveWorldScene({ ref: `form-${rec.form}`, title: rec.form, manifest: statueFormManifest(rec.form, { material: rec.material }) }, { _itemChain: chain, unshaded, ...(viewOpts.era !== undefined ? { era: viewOpts.era } : {}), ...(unshaded ? {} : { light: lightInto(light, statueTurn(rec.dir)) }) });
        if (rec.equestrian) throw new Error(`statue on '${rec.at}': an equestrian slot takes a mounted statue, not the ${rec.form}`);
        baked.set(key, (inner.payload?.faces || []).filter((f) => !f.studio));
      }
      if (!baked.has(key) && rec.hero) {   // an inline hero statue (statues: 'carved', or an entry's `hero`): no store
        const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
        const manifest = expandLayeredManifest({ kind: 'layered', hero: heroRecord(rec.hero, { staleScale: true }) });
        const mounted = statueWords(manifest.hero.statue).stand === 'mounted';
        if (!!rec.equestrian !== mounted) throw new Error(`statue on '${rec.at}': ${rec.equestrian ? 'an equestrian slot takes a mounted statue (statue.stand \'mounted\')' : 'a mounted statue stands on an equestrian slot'}`);
        const inner = await resolveWorldScene({ ref: `hero-${rec.at}`, title: rec.at, manifest }, { _itemChain: chain, unshaded, ...(viewOpts.era !== undefined ? { era: viewOpts.era } : {}), ...(unshaded ? {} : { light: lightInto(light, statueTurn(rec.dir)) }) });
        baked.set(key, (inner.payload?.faces || []).filter((f) => !f.studio));
      }
      if (!baked.has(key)) {
        const src = SketchRepository.getByRef(rec.ref);
        if (!src) throw new Error(`statue on '${rec.at}': ref '${rec.ref}' is not a stored sketch`);
        if (chain.includes(src.ref)) throw new Error(`statue on '${rec.at}': ref '${rec.ref}' places itself (${[...chain, src.ref].join(' → ')})`);
        // an equestrian slot takes a horse and rider, and a horse and rider takes no other slot
        const mounted = src.manifest?.hero?.statue ? statueWords(src.manifest.hero.statue).stand === 'mounted' : false;
        if (rec.equestrian && !mounted) throw new Error(`statue on '${rec.at}': an equestrian slot (a rider on a horse) takes a mounted statue — carve ref '${rec.ref}' with /hero/statue/stand 'mounted', or stand it on a standing slot`);
        if (!rec.equestrian && mounted) throw new Error(`statue on '${rec.at}': ref '${rec.ref}' is mounted (horse and rider); stand it on an equestrian slot`);
        const inner = await resolveWorldScene(src, { _itemChain: chain, unshaded, ...(viewOpts.era !== undefined ? { era: viewOpts.era } : {}), ...(unshaded ? {} : { light: lightInto(light, statueTurn(rec.dir)) }) });
        baked.set(key, (inner.payload?.faces || []).filter((f) => !f.studio));
      }
      payload.faces = [...(Array.isArray(payload.faces) ? payload.faces : []), ...fitStatueFaces(baked.get(key), rec, { s: 1 / unit, group: `statue:${rec.at}:${rec.figure}` })];
    }
  }

  // meshRef (the bind-back door): a figures-map entry may reference a
  // sketch carrying a BOUND external mesh (bind_mesh_render — e.g. an export_model .glb refined
  // in Blender and bound back). The GLB is lowered HERE, server-side, to the standard face-list
  // currency (scene-gltf-read.js: indexed/soup triangles → padded [a,b,c,c] quads, COLOR_0 /
  // baseColor → fill/cornerFills, node TRS applied, y-up→z-up), so every consumer (svg / scene /
  // world / export) inherits the mesh with ZERO emitted-page changes — no runtime GLB loader
  // ships. Static scenery, not a body (re-rigging imported meshes is deferred, per the plan):
  // the entry's `transform` ({ pos, rotZ, scale }) bakes into the corners at resolve time, and
  // the entity-body loop below skips these entries. Runs BEFORE the material/AO/texture channels
  // so they see the decoded faces. The recipe stores only the ref; the decode is LRU-memoized
  // per bound file. No meshRef entries ⇒ every existing payload is untouched.
  if (payload && sketch.manifest.figures && typeof sketch.manifest.figures === 'object') {
    for (const [name, rawSpec] of Object.entries(sketch.manifest.figures)) {
      if (!rawSpec || typeof rawSpec !== 'object' || typeof rawSpec.meshRef !== 'string') continue;
      const { SketchRepository } = await import('@/lib/db/repositories/sketches');
      const src = SketchRepository.getByRef(rawSpec.meshRef);
      if (!src) throw new Error(`figures.${name}: meshRef '${rawSpec.meshRef}' is not a stored sketch`);
      const { latestBoundMesh } = await import('@/lib/graph/scene/mesh-store.js');
      const bound = latestBoundMesh(src.ref);
      if (!bound) {
        // The Claude plugin profile has no bind_mesh_render (lib/mcp/plugin-profile.js): name no door.
        const { pluginProfileActive, pluginProfileNotice } = await import('@/lib/mcp/plugin-profile');
        throw new Error(pluginProfileActive()
          ? `figures.${name}: sketch '${rawSpec.meshRef}' has no bound mesh. ${pluginProfileNotice('Binding a mesh made outside mojulo')}`
          : `figures.${name}: sketch '${rawSpec.meshRef}' has no bound mesh — bind one first via bind_mesh_render`);
      }
      const { readBoundMeshScene } = await import('@/lib/graph/scene/scene-gltf-read.js');
      // A bind made with `units` / `scale` (text-to-cad-seam T4) records `scale_applied` on the
      // sidecar — the file's unit into this sketch's world units. It composes with the placement's
      // own `transform.scale`; absent (every bind before T4), the factor is 1 and nothing moves.
      let unitScale = 1;
      try {
        const { readFileSync } = await import('node:fs');
        const sc = JSON.parse(readFileSync(bound.sidecarPath, 'utf8'));
        if (Number.isFinite(sc.scale_applied) && sc.scale_applied > 0) unitScale = sc.scale_applied;
      } catch { /* no sidecar or unreadable — world units assumed */ }
      const placement = rawSpec.transform && typeof rawSpec.transform === 'object' ? rawSpec.transform : {};
      const transform = unitScale === 1 ? rawSpec.transform : { ...placement, scale: (Number.isFinite(placement.scale) && placement.scale > 0 ? placement.scale : 1) * unitScale };
      const { faces: meshFaces, textures: meshTextures } = readBoundMeshScene(bound.path, { transform, group: `mesh:${name}` });
      // Albedo textures the bound mesh brought home (seam 6b) join payload.textures under the
      // mesh's own keys, so the texture channel below carries them like any other opt-in. A key
      // the world already owns with a DIFFERENT image is re-keyed `<key>@mesh:<name>` on the
      // mesh's faces — the art pass never repaints the world's tile by name collision.
      for (const [k, url] of Object.entries(meshTextures)) {
        const owned = payload.textures?.[k];
        if (owned && owned !== url) {
          const nk = `${k}@mesh:${name}`;
          for (const f of meshFaces) if (f.texture === k) f.texture = nk;
          (payload.textures ??= {})[nk] = url;
        } else if (!owned) (payload.textures ??= {})[k] = url;
      }
      // `singleSide: true` on the placement renders the bound mesh FRONT-faces-only in the live
      // World (scene-three) — a closed solid (a baked, interior-culled statue) shows the same
      // silhouette at half the fragment cost. Opt-in per placement: a bound mesh with inconsistent
      // winding would drop faces, so the operator asserts the mesh is a clean solid.
      const tagged = rawSpec.singleSide === true ? meshFaces.map((f) => ({ ...f, singleSide: true })) : meshFaces;
      payload.faces = [...(Array.isArray(payload.faces) ? payload.faces : []), ...tagged];
    }
  }

  // structures (fractal-structure/): towers grown from a plan, a rise, a crown and an echo, stood anywhere in any
  // world by a few words each. Their faces join here, before the material / AO / texture passes, so those passes see
  // them; their box colliders join an entity world's below. Opt-in; absent ⇒ byte-identical.
  let structureColliders = [], structureRings = [];
  if (payload && sketch.manifest.structures !== undefined) {
    const { structureFaces, validateStructures } = await import('@/lib/graph/fractal-structure/index.js');
    const errs = validateStructures(sketch.manifest.structures);
    if (errs.length) throw new Error(`structures is invalid — see get_view_vocab({ id: 'structures' }):\n- ${errs.join('\n- ')}`);
    const S = structureFaces(sketch.manifest.structures, ctx.light ? { light: ctx.light } : {});
    payload.faces = [...(Array.isArray(payload.faces) ? payload.faces : []), ...S.faces];
    structureColliders = S.colliders; structureRings = S.rings;
  }
  // a geocube domain's structures (era/geocube.js geocubeStructures): its landmarks, painted from the cube and lit by its
  // key (unshaded, the view's light), standing on the domain's land
  const domainStructures = payload && (kind === 'stage' || kind === 'geocube') && sketch.manifest.domain !== undefined ? geocubeStructures(sketch.manifest) : null;
  if (domainStructures) {
    const { structureFaces } = await import('@/lib/graph/fractal-structure/index.js');
    const S = structureFaces(domainStructures.list, { light: unshaded ? ctx.light : domainStructures.light });
    payload.faces = [...(Array.isArray(payload.faces) ? payload.faces : []), ...S.faces];
    structureColliders = [...structureColliders, ...S.colliders]; structureRings = [...structureRings, ...S.rings];
  }

  // science (science-worlds/setting.js): a science world stood in any world, a classical demo 1:1 or any other as a
  // bench prop in a glass case. Its surfaces join before the material / AO passes; its readout and panel ride the
  // page, with the placement's gates (the world's surfaces, its gravity). Opt-in; absent ⇒ byte-identical.
  if (payload && sketch.manifest.science !== undefined && !String(sketch.manifest.kind || '').match(/^(classical|microscopic|quantum|relativistic)-view$/)) {
    const { placeScience } = await import('@/lib/graph/science-worlds/setting.js');
    try { placeScience(payload, sketch.manifest.science); } catch (err) { throw new Error(`${err.message} — see get_view_vocab({ id: 'science-setting' })`); }
  }

  // generic, opt-in procedural VERTEX-COLOUR MATERIALS (materials/procedural-material.js): any face
  // carrying `material: '<preset>'` (or `{ kind, grid?, tint?, wear?, cloud?, seed? }`) is tessellated
  // and vertex-coloured through the layered material system (top-lit ramp + brushed cloud + weathering)
  // — the texture-free Wii-era metal look. Runs BEFORE the AO bake and texture collection so those
  // channels see the expanded faces. Absent `material` on every face ⇒ the list is returned untouched.
  // UNSHADED skips this: the material system's top-lit ramp + brushed cloud + weathering
  // are baked DARKENING, so a flat-albedo export leaves faces at their base tint.
  if (payload && !unshaded && Array.isArray(payload.faces) && payload.faces.length) {
    payload.faces = resolveFaceMaterials(payload.faces);
  }

  // generic, opt-in baked AMBIENT OCCLUSION: any mesh world may set
  // `ao: true` (or a tuning object: { strength, radius, steps }) to darken corners, crevices, and
  // contact junctions — a second baked lighting term beside the Lambert solve, sampled against the
  // world's OWN faces (no per-kind occluder extractor needed). Carried as a payload setting, not a
  // face mutation: the bake must run AFTER facade-card expansion (a card's sub-faces don't exist
  // yet here), so emitThreeWorld and facesToGlb apply effects/ao-bake.js to their expanded face
  // list and faceListToMesh folds the per-corner `vao` into the vertex colours. Every consumer
  // (live /world, PNG/MP4 bakes, .glb export) inherits it. Interior kinds default it ON via
  // their registry descriptor's `ao` field (renderer-convergence 1c) — a manifest `ao: false`
  // always wins. Otherwise additive; absent ⇒ untouched.
  // UNSHADED forces NO occlusion bake: ambient occlusion is a second baked darkening term,
  // exactly what a flat-albedo base must omit (it defaults ON for interior kinds via desc.ao).
  const aoSetting = sketch.manifest.ao ?? desc.ao;
  if (payload && !unshaded && aoSetting && Array.isArray(payload.faces) && payload.faces.length) {
    payload.ao = typeof aoSetting === 'object' ? aoSetting : {};
  }

  // the geocube's VERTEX CONTRAST (era/vertex-contrast.js): a world painted by a cube with `contrast` (a stage's
  // `geocube`, the geocube kind's `cube`, a city's `paint.geocube`) carries it resolved, and the emitters shape the
  // finished faces with it right after the AO bake, which it takes over (its occlusion tinted to the cube's shade). It
  // asks for that bake when it has a contact term, unless the manifest says `ao: false`. Under a tone only value moves.
  // UNSHADED skips it (it is baked shaping). Absent (no cube, or a cube with no contrast) ⇒ no key, byte-identical.
  if (payload && !unshaded && Array.isArray(payload.faces) && payload.faces.length) {
    const vc = geocubeContrastOf(sketch.manifest, { value: !!payload.tone });
    if (vc) {
      // a world not measured in metres (the city plan's 3.66 m unit) carries its unit, so the contrast's metres read
      const mpu = Number(payload.metersPerUnit ?? sketch.manifest.metersPerUnit);
      payload.vertexContrast = Number.isFinite(mpu) && mpu > 0 && mpu !== 1 ? { ...vc, unit: mpu } : vc;
      // (a hero's metal-only shaping asks no bake: its plate takes the foot and the crease, its body keeps its light)
      if (vc.contact > 0 && !vc.only && !payload.ao && sketch.manifest.ao !== false) payload.ao = {};
    }
  }

  // the crease pass (ctx.creases above): the World page reads the resolved terms; stills and exports ignore them
  // (and the land and the plant pools' faces take their class off their groups: scene/crease-roles.js)
  if (payload && ctx.creases && Array.isArray(payload.faces) && payload.faces.length) { payload.creases = ctx.creases; tagCreaseRoles(payload); }
  // the live occlusion pass (ctx.occlusion above): the World page reads the resolved terms; stills and exports ignore them
  // (a room in the form render bakes its occlusion with its light, form/room-light.js: it takes the live pass only when its
  // recipe asks for it, not by its era's default)
  const formRoomOcc = payload && payload.form && payload.form.room && liveL && liveL.from && liveL.from.occlusion === 'form';
  if (payload && ctx.occlusion && !formRoomOcc && Array.isArray(payload.faces) && payload.faces.length) payload.occlusion = ctx.occlusion;

  // generic, opt-in page BACKDROP image: `backdrop: '<url>'` on any mesh-world manifest paints
  // the image behind a TRANSPARENT canvas (emitThreeWorld gates the alpha + CSS on it), so the
  // world's solids composite over the photo — the hangar-bay read. Pure presentation; absent →
  // the emitted page is byte-identical.
  if (payload && typeof sketch.manifest.backdrop === 'string' && sketch.manifest.backdrop.trim()) {
    payload.backdrop = sketch.manifest.backdrop.trim();
  }

  // generic, opt-in face TEXTURES: any mesh world whose faces opt into a surface via
  // `texture: '<key>'` (+ per-corner `uv`) gets the { key: dataURL } map built here — procedural
  // surface-textures.js tiles (soils, grasses, concrete, stone, …) resolved by collectFaceTextures,
  // merged over any assembler-set payload.textures (e.g. the workbench label-wraps) and any explicit
  // manifest.textures (custom dataURL / an image-worker bound PNG). emitThreeWorld + facesToGlb read
  // payload.textures. Additive: a face list with no `texture` opt-ins leaves the payload untouched.
  if (payload && Array.isArray(payload.faces) && payload.faces.length) {
    // (and the instanced repeats' templates: a key only a template draws, a stock tree's leaves, is resolved too)
    const reps = Array.isArray(payload.repeats) ? payload.repeats : Array.isArray(sketch.manifest.repeats) ? sketch.manifest.repeats : [];
    const repeatFaces = reps.flatMap((r) => (Array.isArray(r?.template) ? r.template : []));
    const textures = collectFaceTextures(repeatFaces.length ? [...payload.faces, ...repeatFaces] : payload.faces, { ...(payload.textures || {}) });
    const manifestTex = sketch.manifest.textures;
    if (manifestTex && typeof manifestTex === 'object') {
      for (const [k, v] of Object.entries(manifestTex)) if (typeof v === 'string') textures[k] = v;
    }
    // THE FORM RENDER INDOORS (form/room-form.js): a room baked for the form render has its tiles read as material, each
    // key's colour under no light in place of its paint, its normal, occlusion, height and mean beside it
    if (payload.form && payload.form.room && Array.isArray(payload.form.room.lights)) {
      const keys = payload.faces.filter((f) => typeof f.texture === 'string' && textures[f.texture] && typeof f.group === 'string' && f.group.startsWith('stage:') && f.group !== 'stage:fixture').map((f) => f.texture);
      const R = payload.form.room, F = formRoomMaps(keys, R.detail !== undefined ? { detail: R.detail } : {});
      Object.assign(textures, F.textures);
      payload.form = { ...payload.form, room: { ...R, maps: F.maps, ...(F.reliefSize ? { reliefSize: F.reliefSize } : {}) } };
    }
    if (Object.keys(textures).length) payload.textures = textures;
    // the painted detail tiles' resampling (matte-paint/detail.js, scene/channels/resample.js): only where a page draws one
    const plans = resamplePlans(Object.keys(textures).filter((k) => k.startsWith('detail:')));
    if (Object.keys(plans).length) payload.resample = plans;
  }

  // generic, opt-in INSTANCED REPEATS (renderer-ladder P4): a manifest may carry `repeats` —
  // [{ template: faces[], transforms: [{pos, rotZ?, scale?, tint?}], group? }] — repeated
  // geometry stored once and stamped N times. emitThreeWorld lowers each entry to an
  // InstancedMesh (instances collide/occlude like real geometry); facesToGlb lowers to one
  // shared mesh + N thin nodes. Kind assemblers may also set payload.repeats natively (the
  // fractal-city/condo generators are the intended adopters); the manifest channel is additive
  // and never overrides an assembler's own.
  if (payload && !payload.repeats && Array.isArray(sketch.manifest.repeats) && sketch.manifest.repeats.length) {
    payload.repeats = sketch.manifest.repeats;
  }

  // generic, opt-in MOTION layer: ANY world may carry a `motion` spec — a list of motion-vocabulary
  // rules (ballistic arc, pendulum, spring, …) placed into the scene at a position/scale. Resolved here
  // so every kind gains it uniformly, and appended to the mover channel the renderer already animates.
  // Purely additive — absent `motion` (the common case) leaves every existing payload untouched.
  if (payload && Array.isArray(sketch.manifest.motion) && sketch.manifest.motion.length) {
    const placed = resolveMotionMovers(sketch.manifest.motion);
    if (placed.length) payload.movers = [...(payload.movers || []), ...placed];
  }

  // generic, opt-in adaptive-signage layer (the same channel the /scene + /svg backends read).
  // Chrome is derived from the World's own palette so notes match the scene's visual language.
  // { object } anchors are left unresolved here and bound to a mesh by render-group name at render
  // time (emitThreeWorld's signage channel). Absent `signage` leaves the payload untouched.
  if (payload && Array.isArray(sketch.manifest.signage) && sketch.manifest.signage.length) {
    const { lighting } = resolveSceneLighting(sketch.manifest);
    payload.signs = resolveSignage(sketch.manifest.signage, {
      palette: {
        bg: payload.bg,
        sky: payload.sky ?? lighting?.sky,
        tint: lighting?.tint,
        ambient: lighting?.vexar?.ambient,
        lamps: lighting?.lamps,
        mood: sketch.manifest.time === 'night' ? 'night' : undefined,
      },
    });
  }

  // generic, opt-in PHYSICS property: ANY world may carry a `physics` block
  // (gravity + bodies with mass/restitution/friction/velocity). It is the only LIVE, non-deterministic
  // channel — the browser runs the integrator rather than replaying a baked path — so a world carrying
  // it is flagged `nonBakeable`. The flag is INFORMATIONAL where surfaces cannot run live
  // channels: /svg + /scene degrade to frame zero structurally (they never see this payload),
  // the scene-* MCP tools surface it in their result stats, and /model.glb records the
  // degradation as an X-Mojulo-Degraded response header.
  // Purely additive — absent `physics` leaves every existing payload untouched.
  if (payload && sketch.manifest.physics && Array.isArray(sketch.manifest.physics.bodies) && sketch.manifest.physics.bodies.length) {
    payload.physics = sketch.manifest.physics;
    payload.nonBakeable = true;
    // the ACTIONS channel (input → impulse) rides alongside physics — same live tier.
    if (Array.isArray(sketch.manifest.actions) && sketch.manifest.actions.length) {
      payload.actions = sketch.manifest.actions;
    }
  }

  // generic, opt-in CONTROLLABLE channel: a manifest may carry `entities`
  // (transform + rule + body) and a `camera` spec — the unified "control a thing in a world" primitive
  // (walk/glide/follow/clock). It rides ON TOP of any recognized world kind (a figure walking a stored
  // city, a drone over a room), so it is gated on an existing `payload`. Input-driven ⇒ `nonBakeable`.
  // `figure-frames` bodies reference a baked-at-resolve-time figure: manifest.figures is a map of
  // name → renderFigureWorldFrames spec ({ motion, proto, frames? }); we bake each here so the stored
  // manifest stays a tiny recipe (no packed geometry persisted), matching the rest of the substrate.
  // MECHANIC DECORATION (U5): a level declared purely as `game.mechanics`
  // gets its default UI-language dressing here — glyph pickup/exit bodies + fx float/burst + sfx
  // sparkle/aura — merged into the manifest BEFORE the entities/glyph/fx/sfx lowering below, so a
  // verbs-only level renders legible + juicy with zero styling. Default-ON; `game.decorate:false`
  // opts out; hand-authored entities/fx/sfx compose on top. The decoration's bus reactions + the
  // set of mechanic markers it replaces are applied to the mechanics events further down.
  let decorReactions = null;
  let decorSuppress = null;
  if (payload && sketch.manifest.game && Array.isArray(sketch.manifest.game.mechanics)
      && sketch.manifest.game.mechanics.length && sketch.manifest.game.decorate !== false) {
    const { decorateMechanics, mergeDecorFx } = await import('@/lib/graph/game/mechanic-decor');
    const decor = decorateMechanics(sketch.manifest.game.mechanics);
    decorReactions = decor.reactions;
    decorSuppress = new Set(decor.suppress);
    const m = sketch.manifest;
    sketch = { ...sketch, manifest: {
      ...m,
      entities: [...(Array.isArray(m.entities) ? m.entities : []), ...decor.entities],
      fx: mergeDecorFx(m.fx, decor.fx),
      sfx: [...(Array.isArray(m.sfx) ? m.sfx : []), ...decor.sfx],
    } };
  }

  // shadows: any world can opt in, entity-bearing or not. `shadows: true / { r, alpha, fade,
  // occlude, … }` is the suit contact-blob decal (controllable worlds — a soft down-probed pool
  // under every rig-figure body, the landing tell). `shadows: { cast: true, alpha?, span?,
  // mapSize?, toLight? }` is the scene-level CAST-SHADOW channel: real shadow-map silhouettes
  // off every opaque mass and figure (static masses, walkers, controllable bodies), light keyed
  // to the payload's baked sun when one exists. `shadows: { actors: true }` and `{ hour: true }` are the LIVE LIGHT's
  // split of it (scene/live-light.js, read and checked into ctx.liveSun above): what moves casts each frame, the static
  // world into its own map when the hour changes. Opt-in; absent ⇒ byte-identical.
  // (the live light's defaults filled in: liveL above; the unshaded export carries the recipe's own)
  // (a room in the form render, under no sun, bakes its lamps' shadows: of the live light it keeps what moves, the actors)
  const shadowsOut = payload && payload.form && payload.form.room ? (liveL && liveL.shadows && liveL.shadows.actors ? { actors: true } : null) : liveL ? liveL.shadows : sketch.manifest.shadows;
  if (payload && shadowsOut) payload.shadows = shadowsOut;
  // the tier the live light costs at (its maps' size, its occlusion's resolution) and the page's budget probe: only on a
  // page with live light on
  if (payload && liveL && liveL.tier) payload.lightTier = liveL.tier;
  // (a read in another era than its cube's says so where the cube's look is read back)
  if (payload && payload.geocube && viewOpts.era !== undefined && payload.geocube.era !== era) payload.geocube = { ...payload.geocube, era };
  // THE WATER, LIVE (era/water-live.js): a 'form' era's read on the page draws a trail's river and falls as they move,
  // the landscape views' own water (the surface channel's river, a sheet jet into a shallows pond), in the place of the
  // painted sheets it leaves out of the faces (so the form render never reads them). Any other read, a still's paint and
  // the exports: the painted water. Either way the plan and its tags are the builder's, never a page's
  if (payload && payload.waterworks) {
    const W = !unshaded && viewOpts.paint !== true && ERAS[era]?.surface === 'form' ? lowerWaterworks(payload.waterworks, { sky: payload.sky, bg: payload.bg }) : null;
    const drawn = new Set(W ? W.drawn : []);
    payload.faces = payload.faces.filter((f) => !(f.waterBody && drawn.has(f.waterBody))).map((f) => { if (!f.waterBody) return f; const { waterBody: _w, ...rest } = f; return rest; });
    if (W) {
      if (W.surfaces) payload.surfaces = [...(payload.surfaces || []), ...W.surfaces];
      if (W.shallows) payload.shallows = { bodies: [...(payload.shallows?.bodies || []), ...W.shallows.bodies], floaters: [...(payload.shallows?.floaters || []), ...W.shallows.floaters] };
      if (W.jets) payload.jets = [...(payload.jets || []), ...W.jets];
    }
    delete payload.waterworks;
  }
  // THE FORM RENDER'S LAND (gen-7): a 'form' era's read of a geocube's island or trail carries its land as material
  // (form/land-read.js: the cube's light solved for its palette, the layers, the trail's dress, the scree's stones, the
  // biocube's moss), drawn
  // on the page in the painted land's place (scene/channels/form-land.js). The trail's dress its words: rubble on or off,
  // its patches. Any other read, and the unshaded export: none, every byte as it was. The engine handoff (scene/handoff.js,
  // `handoff: true`) reads it unshaded: its land's data is what an engine is handed, its light the engine's own
  // (and a glyph map a geocube paints, level/grid-scene.js: its land and its plants read as the cube's trail's are, its
  // level's cube, hour, clouds and biocube the recipe's words)
  const formMap = sketch.manifest.kind === 'map' && sketch.manifest.level?.grid && sketch.manifest.level.geocube !== undefined;
  if (payload && (!unshaded || viewOpts.handoff === true) && viewOpts.paint !== true && (sketch.manifest.kind === 'geocube' || formMap) && ERAS[era]?.surface === 'form') {
    // (a metro's land a town's too, geocity/scene.js: its lawns mown, no trail's rubble)
    const M = formMap ? { ...sketch.manifest.level, cube: sketch.manifest.level.geocube } : sketch.manifest, path = M.path && typeof M.path === 'object' ? M.path : {}, town = M.show === 'geotown' || M.show === 'geocity';
    // (a town, geotown: its land a lawn's, no trail's rubble, dust, clay or patches)
    const dress = town ? { ...DRESS_DEFAULT, rubble: 0, dust: 0, clay: 0, patches: [] } : { ...DRESS_DEFAULT, ...(path.rubble === false ? { rubble: 0 } : {}), ...(path.patches === false ? { patches: [] } : Array.isArray(path.patches) ? { patches: path.patches } : {}) };
    // (the biocube's words the form render reads: the rock's moss, `flora.moss`; the grass's length, `flora.grass.sward`;
    // its drifts, `flora.grass.drifts` and `flora.flowers`; the recipe's biocube or else the cube's, none without)
    // (a town's lawns are mown: the short sward, no meadow's drifts)
    const cube = readGeocube(M.cube), bio = M.biocube ?? cube.biocube, F = bio ? readBiocube(bio).flora : null, moss = town ? 0 : F?.moss ?? 0, sward = town ? 'short' : F?.grass?.sward;
    const drifts = town ? [] : readDrifts({ drifts: F?.grass?.drifts, flowers: F?.grass ? F.flowers : null });
    // (a raised view's ground claimed, form/flora-read.js viewHeld: no crown over an overlook's eye in what it looks over)
    if (payload.plants && !town) payload.plants = viewHeld(payload.plants, payload.cameras, { kinds: payload.plants.kinds });
    // (where the form grows its own plants, floraBox: the painted trees and bushes there are not read as land)
    const grown = floraBox(payload.plants);
    // (a winter, snow over the whole land with no line, grows no grass at all; under a snow line the grass stands below it)
    const S0 = payload.snowMap ? readSnow(cube.snow) : null, winter = !!S0 && (S0.line === undefined || S0.line === null);
    // (a map carries no camera of its own: the land is read framed from the south over its middle, raised, as an island's)
    const mapCam = formMap && !(payload.cameras ?? []).length && payload.map ? (() => { const W = payload.map.cols * payload.map.tile, H = payload.map.rows * payload.map.tile; return [{ name: 'island', worldFraming: { cameraPosition: [W / 2, -H * 1.15, H * 0.55], lookAt: [W / 2, -H / 2, 0], horizontalFov: 60, pictureCenter: [560, 390] } }]; })() : null;
    const read = landRead(mapCam ? { ...payload, cameras: mapCam } : payload, cube, { ...(M.hour !== undefined ? { hour: readHour(M.hour) } : {}), dress, grass: winter ? false : 'map', ...(moss ? { moss } : {}), ...(sward !== undefined ? { sward } : {}), ...(drifts.length ? { drifts } : {}), ...(grown ? { grown } : {}), ...(payload.snowMap ? { snow: payload.snowMap } : {}) });
    if (read) payload.form = { ...(payload.form || {}), land: formPayload(read) };
    // (a map's far range, level/far-range.js, stands hundreds of metres out: its own haze, the page's fog thinned over it
    // and less of the sky's air, so its mountains read through a morning's haze; channels/form-land.js)
    if (read && formMap) payload.form.land.haze = MAP_HAZE;
    // (the recipe's weather for the form's sky, channels/form-sky.js: its clouds, or the weather's own; absent, the sky reads
    // what the stage painted)
    if (read && M.clouds !== undefined) payload.form.land.clouds = M.clouds === 'weather' ? { kind: CLOUDS_OF_WEATHER[M.weather] || 'fair', cover: 0.5, seed: 1 } : readClouds(M.clouds);
    // (the view cone's reach fixed in metres, channels/view-cone.js; absent, the screen's)
    if (read && M.cone !== undefined && M.cone !== null) payload.form.land.cone = readCone(M.cone);
    // (and its dunes' sand drawn by the wind that laid them: ripples, slip faces, glint; era/out-dunes.js duneMap)
    if (read && payload.dunes) payload.form = { ...payload.form, land: { ...payload.form.land, dunes: payload.dunes } };
    // (and its snow laid over the ground as it lies: era/snow.js snowMap, its colour solved under the cube's light)
    if (read && payload.snowMap) payload.form = { ...payload.form, land: { ...payload.form.land, snow: { ...payload.snowMap, base: snowBase(payload.snowMap.albedo, read.light) } } };
    // (its plants grown as form where the trail's placement stood them, form/flora-read.js: the painted trees, bushes and
    // shrubs hidden in their place; a bamboo or a blossom card keeps its own)
    const flora = read && payload.plants ? floraRead(payload.plants, { kinds: payload.plants.kinds, bushKinds: payload.plants.bushKinds, colours: cube.colour, bases: read.light.linearBases, autumn: F?.autumn ?? 0 }) : null;
    // (a glyph map says what of the form it got: a gen-7 map is the form render's, never paint under the live light)
    if (formMap && payload.map) payload.map.form = read ? { read: true, plants: !!flora, far: 'range' } : { read: false, why: 'the map has no land the form reads' };
    // (and a metro says what of the form it got, geocity/scene.js: its lawns, its street trees and its towns' grown)
    if (M.show === 'geocity' && payload.geocity) payload.geocity.form = read ? { read: true, plants: !!flora } : { read: false, why: 'the metro has no soft ground the form reads' };
    // (a metro's buildings keep their own tiers, detail, massing and skyline, geocity/scene.js, lit by the live light: no
    // far structure's card is baked for them, channels/far-structures.js, whose cards read a painted fill a metro's
    // textured faces do not carry)
    if (read && M.show === 'geocity') payload.form.land.structures = false;
    if (flora) {
      const stamped = (payload.repeats || []).map((r) => r.group).filter((g) => g && g.startsWith('isekai:trees:'));
      payload.form = { ...payload.form, land: { ...payload.form.land, hides: [...new Set([...payload.form.land.hides, ...FLORA_HIDES, ...stamped])] }, flora };
    }
    // (the gen-6 live grass's blades go with the painted land: the form render's grass is its own; its wind stays, and the
    // crowns' sway in it, so the form's grass bends in the same gusts as the trees; channels/form-grass.js)
    if (read && payload.liveGrass) {
      const { grid, wind, crowns, seed, cards, petals } = payload.liveGrass;
      if (wind && grid) payload.liveGrass = { grid, wind, crowns, seed, cards, field: false, ...(petals ? { petals } : {}) };
      else delete payload.liveGrass;
    }
    // (and its blade cards, never walked on: gone from the page, not only hidden)
    if (read) payload.faces = payload.faces.filter((f) => f.group !== GRASS_CARDS);
  }
  // (a glyph map read in a form era that no geocube paints: drawn as paint under the live light, and says so, with how to
  // have the form's: the map's level names its geocube, level/grid-scene.js)
  if (payload && payload.map && !formMap && sketch.manifest.kind === 'map' && sketch.manifest.level?.grid && ERAS[era]?.surface === 'form' && !unshaded && viewOpts.paint !== true) payload.map.form = { read: false, why: 'no geocube paints the map: name its level\'s geocube (level.geocube, or a gameworld style\'s) for the form render\'s land, plants and far range' };
  // (a gen-7 geocube page without the form render, a geocity: the form's sky over it, channels/form-sky.js, its light the
  // cube's own sky colours, its sun the page's, its clouds the recipe's)
  if (payload && !payload.form && sketch.manifest.kind === 'geocube' && ERAS[era]?.surface === 'form' && payload.sky && !payload.sky.space && Array.isArray(payload.sky.zenith) && Array.isArray(payload.sky.sun?.dir)) {
    const Mc = sketch.manifest.clouds;
    payload.formSky = { sun: payload.sky.sun.dir, zenith: payload.sky.zenith, horizon: payload.sky.horizon,
      ...(Mc !== undefined ? { clouds: Mc === 'weather' ? { kind: CLOUDS_OF_WEATHER[sketch.manifest.weather] || 'fair', cover: 0.5, seed: 1 } : readClouds(Mc) } : {}) };
  }
  // (a page without the form render carries the view cone and its far structures only when its world asks: `cone`)
  if (payload && !payload.form && sketch.manifest.cone !== undefined && sketch.manifest.cone !== null) payload.cone = readCone(sketch.manifest.cone);
  // (the crust softened past the cone's reach, `cone.soften`: the page's frame pass, channels/frame-pass.js; a page's read only)
  { const C = payload ? (payload.form?.land?.cone ?? payload.cone) : null; if (C && C.soften && !unshaded && viewOpts.paint !== true) payload.soften = C.soften; }
  // THE AIR of a gen-7 geocube page (channels/atmosphere.js): the recipe's `air`, a fog by its visibility over the outside
  // (lying low over the walk's ground, glowing toward the sun) or the inside (a hall, a room, a cavern: even), the gen-7
  // sky veiled to it and the far softened past the view cone. Read on any geocube read (a bad word refuses there too);
  // drawn on a gen-7 page alone: a painted page keeps its haze, and the unshaded export its faces
  if (payload && sketch.manifest.kind === 'geocube' && sketch.manifest.air !== undefined) {
    const sun = payload.sky && !payload.sky.space && Array.isArray(payload.sky.sun?.dir) ? payload.sky.sun.dir : null;
    // (inside is what the page is, a room's form or a cavern, never the sun's absence: a night outside has none)
    const inside = !!payload.form?.room || (payload.anchors || []).some((a) => a && a.kind === 'cavern');
    const A = readAtmosphere(sketch.manifest.air, { where: inside ? 'inside' : sketch.manifest.show === 'geocity' ? 'city' : 'outside' });
    if (A && !unshaded && viewOpts.paint !== true && ERAS[era]?.surface === 'form') {
      const spawn = Array.isArray(payload.walk?.spawn) ? payload.walk.spawn : null;
      // (a room's air is the colour of the room's own light, not the sky's: roomAirColour; a cavern keeps its page's dark)
      // (the recipe's own colour wins: a neon night's air the glow of its lights)
      const room = payload.form?.room, colour = A.colour ?? (room && Array.isArray(room.ambient) ? roomAirColour(room) : null);
      payload.air = atmosphereInput(A, { base: spawn && Number.isFinite(spawn[2]) ? spawn[2] : 0, sun: inside ? null : sun, unit: payload.metersPerUnit || 1, colour });
    }
  }
  // (where the plants stand is the form render's read alone: never on a page)
  if (payload && payload.plants) delete payload.plants;
  if (payload && payload.dunes) delete payload.dunes;
  if (payload && payload.snowMap) delete payload.snowMap;
  // crystal light (crystal-rig R3): lamps whose beams pass through the world's crystals, each gem an operator. Any
  // world can carry it; emitThreeWorld resolves it against the faces. Opt-in; absent ⇒ byte-identical.
  // effect light (scene/effect-light.js): what a world's beams and moments throw on it, by rule. Opt-in: one word.
  // The effects' style floor (scene/effect-style.js): every beam and explosion raised to it, by rule. Opt-in: one word,
  // or a composed floor (scene/juice-style.js: { register: anime | western, flavor: the game type, …dials }). Both are
  // laid on the world's events here, and again on the events its play's cues make below (which are built afresh)
  const fxOnto = async (events) => {
    let out = events;
    if (sketch.manifest.fxLight !== undefined) {
      if (typeof sketch.manifest.fxLight !== 'boolean') throw new Error('fxLight is true (the light a world\'s beams, puffs and explosions throw on it, by rule) or false');
      if (sketch.manifest.fxLight && out) out = { ...out, fxLight: true };
    }
    if (sketch.manifest.fxStyle === undefined) return out;
    const fxs = sketch.manifest.fxStyle;
    if (typeof fxs !== 'boolean' && !(fxs && typeof fxs === 'object' && !Array.isArray(fxs))) throw new Error('fxStyle is true (every beam and explosion raised to the effects\' style floor, by rule), false, or { register?, flavor?, …dials } (the floor composed for the game: scene/juice-style.js)');
    if (fxs === true && out) return { ...out, fxStyle: true };
    if (!fxs) return out;
    const { readJuiceStyle, fidelityOfRead } = await import('@/lib/graph/scene/juice-style.js');
    const S = readJuiceStyle(fxs);
    if (!out) return out;
    // (a floor at the era's fidelity is drawn at the read's: the sixth generation's paint, the seventh's form)
    out = { ...out, fxStyle: S.fidelity ? { ...S, fidelity: fidelityOfRead(S.fidelity, era) } : S };
    // on the flow (rupa-vayo, rupa/vayo.js): the air its effects move in is the world's one wind (its physics' own when it
    // names one), at 10 m; a still world's is still
    if (S.flow) {
      const W = (sketch.manifest.matter && sketch.manifest.matter.wind) || physicsWind(sketch.manifest.wind);
      const sp = W && W.speed > 0 ? W.speed : 0, d = W && Array.isArray(W.dir) ? Math.atan2(W.dir[1], W.dir[0]) : (((W && W.dir) || 0) * Math.PI) / 180;
      if (sp > 0) out = { ...out, flowWind: [Math.round(sp * Math.cos(d) * 1000) / 1000, Math.round(sp * Math.sin(d) * 1000) / 1000] };
    }
    return out;
  };
  if (payload && payload.events) payload.events = await fxOnto(payload.events);
  else if (payload) await fxOnto(null);   // (checked all the same)
  if (payload && sketch.manifest.crystalLight) {
    const { validateCrystalLight } = await import('@/lib/graph/scene/crystal-rig.js');
    const errs = validateCrystalLight(sketch.manifest.crystalLight);
    if (errs.length) throw new Error(`crystalLight is invalid — see get_solid_vocab({ id: 'workbench' }), "Light rigs":\n- ${errs.join('\n- ')}`);
    payload.crystalLight = sketch.manifest.crystalLight;
  }
  // fire (flame-depiction): live flames that light the world. A kind that knows where its fires are hands them over as
  // payload.fireSources (a dungeon's chambers and tunnels; a terrain's sources set on the ground); `fire.sources` with
  // a 3D `at` add to them anywhere. Opt-in; absent ⇒ byte-identical.
  // A play block's burning statuses (playscape elements burning / blaze) add a fire per body they may set alight.
  // (and a status a body is born under: a foe's base state)
  const bornAlight = Array.isArray(sketch.manifest.entities) && sketch.manifest.entities.some((e) => e && e.body && e.body.born && e.body.born.statuses && Object.keys(e.body.born.statuses).length);
  const bodyFire = payload && (sketch.manifest.play || bornAlight) ? (await import('@/lib/graph/playscape/elements/body-fire.js')).bodyFires(sketch.manifest.play, sketch.manifest.entities) : [];
  if (payload && (sketch.manifest.fire || bodyFire.length)) {
    const { validateFire, resolveFire, firePageChannel } = await import('@/lib/graph/fire/fire.js');
    const errs = validateFire(sketch.manifest.fire);
    if (errs.length) throw new Error(`fire is invalid — see get_view_vocab({ id: 'dungeon' }) or ({ id: 'terrain' }), "Fire":\n- ${errs.join('\n- ')}`);
    const placed = [...(payload.fireSources || []), ...bodyFire];
    const r = resolveFire(sketch.manifest.fire || {}, placed, { explicit: !payload.fireSourcesAll, spread: payload.fireSpread || null });
    if (r) payload.fire = firePageChannel(r, { terrainAir: !!payload.terrain, day: payload.sky && Number.isFinite(payload.sky.day) ? payload.sky.day : 0 });
  }
  if (payload) { delete payload.fireSources; delete payload.fireSourcesAll; delete payload.fireSpread; }
  if (payload && Array.isArray(sketch.manifest.entities) && sketch.manifest.entities.length) {
    payload.entities = sketch.manifest.entities;
    if (sketch.manifest.camera && sketch.manifest.camera.rule) payload.camera = sketch.manifest.camera;
    // suit switcher: `pilot` names the initially-piloted `pilotable` entity (default: the first one)
    if (typeof sketch.manifest.pilot === 'string') payload.pilot = sketch.manifest.pilot;
    // spectate: NO pilot — the whole cast runs its ai brain and the
    // operator watches from a glide/follow spectator camera (WASD free-fly, Tab cycles the watched
    // fighter). Opt-in; absent ⇒ the world seats a pilot as before (byte-identical).
    if (sketch.manifest.spectate === true) payload.spectate = true;
    // SEATS (docs/local-multiplayer-principles.md): `seats: { bodies, max?, join?, drop?, floor? }`, the pilotable bodies seats 2 to 4 take, each
    // a player's own controller on the page (scene/channels/controllable seatsScript). Opt-in; absent ⇒ byte-identical.
    if (sketch.manifest.seats !== undefined) payload.seats = readSeats(sketch.manifest.seats, sketch.manifest.entities, payload.pilot);
    // AI-attack switch: `ai:'off'` loads the world passive (ai-ambient suits stand down until the
    // G / HUD toggle wakes them); absent ⇒ authored ai runs from load.
    if (typeof sketch.manifest.ai === 'string') payload.ai = sketch.manifest.ai;
    // lateral blocking: analytic AABB colliders (the invisible collision hull under the visual
    // faces) — the platform rule ejects the suit's footprint from them.
    if (Array.isArray(sketch.manifest.colliders) && sketch.manifest.colliders.length) payload.colliders = sketch.manifest.colliders;
    // structures (above): a box for each tier and plinth step of each tower, so a walker stands on its terraces
    if (structureColliders.length) payload.colliders = [...(payload.colliders || []), ...structureColliders];
    if (parkedColliders.length) payload.colliders = [...(payload.colliders || []), ...parkedColliders];
    // blocks (playscape/terrain.js standBlocks): forms the level stands in its stage, solid and drawn (a shooter's
    // cover: low walls, crates). Absent ⇒ byte-identical.
    if (Array.isArray(sketch.manifest.blocks) && sketch.manifest.blocks.length) {
      const B = standBlocks(sketch.manifest.blocks, { seed: Number.isInteger(sketch.manifest.seed) ? sketch.manifest.seed : 1 });
      payload.faces = [...(payload.faces || []), ...B.faces];
      payload.colliders = [...(payload.colliders || []), ...B.colliders];
    }
    // hangar: the non-combat suit-stepper menu — an ordered list of
    // display-entity suits { id, name } the emitted controllable runtime cycles (◀/▶). Opt-in; absent
    // ⇒ no menu emitted (byte-identical).
    if (sketch.manifest.hangar && typeof sketch.manifest.hangar === 'object') payload.hangar = sketch.manifest.hangar;
    // match: the scored-bout layer — kills credited, respawns, first
    // to killTarget wins (scoreboard + result HUD in the emitted runtime). Opt-in; absent ⇒ byte-identical.
    if (sketch.manifest.match && typeof sketch.manifest.match === 'object') payload.match = sketch.manifest.match;
    // target lock: `lock: true | { range, cone, release, aimRate, los, pitch }`
    // — the pilot locks onto a hittable and is steered to face it; `camera.lockTrack` frames the
    // pair. Opt-in; absent ⇒ byte-identical.
    if (sketch.manifest.lock === true || (sketch.manifest.lock && typeof sketch.manifest.lock === 'object')) payload.lock = sketch.manifest.lock;
    // projectile smoke: pooled billow-sprite puffs on the bazooka/grenade fire trail + a seeded
    // rolling cloud at each detonation, read off the engine's projectiles/bursts records. `true`
    // or a tuning object { max, spacing, alpha, burstCount, trailTint, burstTint }. Opt-in;
    // absent ⇒ byte-identical (the smoke-test experiment map is the first consumer).
    if (sketch.manifest.smoke) payload.smoke = sketch.manifest.smoke;
    // wreck finisher (dev-rules sequence): a destroyed suit's death burst is DEFERRED until its
    // topple fall settles, then the wreck DETONATES (staggering + smoking) and VANISHES — fall →
    // boom → gone, instead of the instant blast that leaves a persistent wreck. `true` or a tuning
    // object { delay } (seconds the settled wreck lingers before it blows). Non-match worlds only
    // (a match owns its own corpse-window → respawn lifecycle). Opt-in; absent ⇒ byte-identical.
    if (sketch.manifest.wreckExplodes) payload.wreckExplodes = sketch.manifest.wreckExplodes;
    // breakability (playscape/destruct/breakability.js): how much the game lets break, a convention by degree
    // (`destruction` on the level; a game's degree is copied onto its levels when they are composed); the breakable
    // things become the runtime's blocks, their faces their own render group, their colliders the blocks'; each is
    // pre-cut into the pieces the page swaps in when it breaks. Absent or
    // 'none' ⇒ nothing breaks, byte-identical.
    const destruction = readDegree(sketch.manifest.destruction, 'destruction');
    // under `physical`, a world painted by a geocube breaks by the cube's matter (era/geocube.js cubeMatter: read off its skins)
    // (a physical geocity's near ring, geocity/scene.js: its nearest buildings as shell houses, each its eave, its own face
    // groups and its finish's word, coarse panels for a city's masses; rupa/shell-blocks.js makes them walls and a roof)
    if (destruction === 'physical' && Array.isArray(payload.physicalRing) && payload.physicalRing.length) {
      payload.colliders = [...(payload.colliders || []), ...payload.physicalRing.map((b) => ({ min: b.min, max: b.max, of: `${b.id}:house`, eave: b.eave, group: b.group, coarse: true, ...(b.word ? { word: b.word } : {}), ...(b.flat ? { flat: true } : {}) }))];
    }
    const cubeMatterOf = destruction === 'physical' ? geocubeMatterOf(sketch.manifest) : null;
    // (a town's houses break as the settlement they were built from: its style's words, era/geocube.js settlementMatter)
    const townMatterOf = destruction === 'physical' ? geocubeTownMatterOf(sketch.manifest, payload) : null;
    const broken = breakablesOf(payload, destruction, destruction === 'physical' ? { matterOf: cubeMatterOf } : {});
    // under `physical`, the big things too (rupa/shell-blocks.js): a structure's tiers in courses, its rings in wall-thick
    // cells, a town's shell houses as walls and a roof, each on a footing; and the load at minute zero (rupa loadAudit)
    const shells = destruction === 'physical'
      ? shellBlocks({ faces: broken ? broken.faces : payload.faces, colliders: broken ? broken.colliders : payload.colliders }, { rings: structureRings, matterOf: cubeMatterOf || townMatterOf ? { ...(cubeMatterOf || {}), ...(townMatterOf ? { town: townMatterOf } : {}) } : null })
      : null;
    // and its trees (rupa/tree-blocks.js): each built near the trail a trunk in courses and a crown, breaking, burning and
    // thrown by a storm (the stage's `physicalTrees`, carried only under physical, then taken off the payload)
    const facesSoFar = shells ? shells.faces : broken ? broken.faces : payload.faces;
    const treeSet = destruction === 'physical' && Array.isArray(payload.physicalTrees) ? treeBlocks(payload.physicalTrees, facesSoFar, { matterOf: cubeMatterOf }) : null;
    if (payload.physicalTrees !== undefined) delete payload.physicalTrees;
    if ((broken && broken.breakables.length) || shells || treeSet) {
      const faces = treeSet ? treeSet.faces : facesSoFar, colliders = [...(shells ? shells.colliders : broken ? broken.colliders : payload.colliders || []), ...(treeSet ? treeSet.footings : [])];
      const breakables = [...(broken ? broken.breakables : []), ...(shells ? shells.breakables : []), ...(treeSet ? treeSet.breakables : [])];
      payload.faces = faces; payload.colliders = colliders; payload.breakables = breakables; payload.breakPieces = piecesOf(breakables, faces, shells || treeSet ? { share: true } : {});
      // (payload metadata, not drawn: what was built stands by itself, or what falls at once, is crushed, or sags)
      if (destruction === 'physical') payload.rupaAudit = { ...loadAudit(breakables, { colliders }), ...(shells ? { shells: shells.groups } : {}), ...(treeSet ? { trees: treeSet.trees.length } : {}) };
    }
    // destructible physics (rupa/, `destruction: 'physical'`): the blocks carry their matter (breakablesOf), and the
    // level's `matter` says how hard the world's blows land ({ power?, swing?, shot?, blastZ? }); the page composes the
    // opt-in rupa builder. Any other degree ⇒ no key, byte-identical.
    // (an object's metal panels, rupa/panels.js: resolved to their plates and their metal's numbers; refused by name if not)
    const panelled = destruction === 'physical' && Array.isArray(payload.entities) && payload.entities.some((e) => e && e.panels != null && e.panels !== false);
    if (panelled) payload.entities = payload.entities.map((e) => (e && e.panels != null && e.panels !== false ? { ...e, panels: readPanels(e) } : e));
    if (destruction === 'physical' && (payload.breakables || payload.physicalGround || panelled)) {
      payload.rupa = readMatterSpec(sketch.manifest.matter, 'matter');
      // (its land as a soil grid the page digs, rupa/ground-grid.js, from the stage's landform and substrate)
      const ground = groundGrid(payload.physicalGround);
      if (ground) {
        // (and its still water, the stage's lake and sea: on the grid, and as pools what falls in floats or sinks in)
        const water = waterBodies(payload.anchors);
        if (water.length) {
          ground.water = water;
          payload.rupa.pools = [...(payload.rupa.pools || []), ...readMatterSpec({ pools: water.map((w) => ({ min: w.min, max: [w.max[0], w.max[1], w.level], liquid: 'water' })) }, 'water').pools];
        }
        payload.rupa.ground = ground;
      }
      // one wind (rupa/one-wind.js): the level's own `wind`, the one its plants, grass and cloth sway in, is the air its
      // blocks, dust, smoke and leaves feel, matched at 2 m and 10 m; the level's `matter.wind` overrides it for the physics
      if (!payload.rupa.wind && sketch.manifest.wind) { const w = physicsWind(sketch.manifest.wind); if (w) payload.rupa.wind = w; }
      // (its trees: each its blocks and the wind that snaps it, for the runtime's storm)
      if (treeSet && treeSet.trees.length) payload.rupa.trees = treeSet.trees;
      // what each striker strikes with (a tool word on its rule): checked here, read by the page as given
      for (const e of payload.entities || []) if (e && e.rule && e.rule.strikeTool !== undefined) readTool(e.rule.strikeTool, `${e.id || 'entity'}.rule.strikeTool`);
      // what can burn carries its own flame (fire/fire.js blockFires), off until it catches; added to the level's fire
      if ((payload.breakables || []).some((b) => b.burnRate > 0)) {
        const { blockFires, firePageChannel } = await import('@/lib/graph/fire/fire.js');
        const had = payload.fire && Array.isArray(payload.fire.sources) ? payload.fire.sources : [], more = blockFires(payload.breakables, { from: had.length });
        if (more.length) payload.fire = payload.fire ? { ...payload.fire, sources: [...had, ...more] }
          : firePageChannel({ embers: true, smoke: true, light: 1, sources: more }, { terrainAir: !!payload.terrain, day: payload.sky && Number.isFinite(payload.sky.day) ? payload.sky.day : 0 });
      }
    }
    // on the flow (rupa-vayo), a blast's air reaches the world's fires: it fans them or blows them out
    // (worlds/controllable/vayo-air.js; the fire channel's `gusts`). A world not on the flow, or with no fires, keeps its bytes
    { const fxs = sketch.manifest.fxStyle;
      if (payload && payload.fire && Array.isArray(payload.fire.sources) && payload.fire.sources.length && fxs && typeof fxs === 'object' && fxs.flow) payload.fire = { ...payload.fire, gusts: true }; }
    // knockback apart from damage (worlds/controllable/knock.js): the level's own (`knockback`); the attacks that carry
    // their own kinetic or impact are found where the page is emitted (scene-three.js). Neither ⇒ no byte of it
    if (payload && sketch.manifest.knockback !== undefined && sketch.manifest.knockback !== false) {
      const { readKnockback } = await import('@/lib/graph/rupa/knock.js');
      payload.knock = readKnockback(sketch.manifest.knockback);
    }
    // a hero's vayo moves (special abilities on its own air, rupa/vayo-move.js): checked here, moved by the page
    if ((payload?.entities || []).some((e) => e && e.rule && e.rule.vayo !== undefined)) {
      const { readVayo } = await import('@/lib/graph/rupa/vayo-move.js');
      for (const e of payload.entities) if (e && e.rule && e.rule.vayo !== undefined) readVayo(e.rule.vayo, `${e.id || 'entity'}.rule.vayo`);
    }
    // scars (cosmetic damage): a map that may not change still shows what blows would do to it (rupa/index.js
    // readScarsSpec: its ground's soil and its walls' matter, from the world's cube unless named). Absent ⇒ no byte
    // (outdoors, the ground a crater is painted in is the land's own: its commonest ground off the path, the cube's readout,
    // era/substrate.js; a cube that names its ground keeps it)
    const scarCube = () => { const C = geocubeMatterOf(sketch.manifest), land = groundOfShares(payload.geocube?.substrate); return land && !(C?.ground?.why === 'the cube says so') ? { ...(C || {}), ground: land } : C; };
    const scars = sketch.manifest.scars ? readScarsSpec(sketch.manifest.scars, { cube: scarCube() }) : null;
    if (scars) payload.rupa = { ...(payload.rupa || readMatterSpec(sketch.manifest.matter, 'matter')), scars };
    // tutorial: the scripted teaching layer — ordered prompt+goal steps
    // the engine director advances by edge-detecting the sim; the director is the level terminal
    // (tutorial levels run no match). Opt-in; absent ⇒ byte-identical.
    if (sketch.manifest.tutorial && typeof sketch.manifest.tutorial === 'object') payload.tutorial = sketch.manifest.tutorial;
    // aiDifficulty: mint-time tier seed ('easy' | 'medium' | 'max') for worlds whose difficulty is
    // authored rather than shell-picked (tutorial levels); the game-params seam still overrides.
    if (typeof sketch.manifest.aiDifficulty === 'string') payload.aiDifficulty = sketch.manifest.aiDifficulty;
    // commander: who drives the bodies marked `rule.commanded` ({ port, period, url, hook };
    // worlds/controllable/commander.js). Page-only; no commanded body ⇒ byte-identical.
    if (sketch.manifest.commander && typeof sketch.manifest.commander === 'object') payload.commander = sketch.manifest.commander;
    payload.nonBakeable = true;
    const figs = sketch.manifest.figures;
    // A MACHINE'S JUICE AT ITS FIDELITY (car-designer/juice.js rigFidelity): the world's composed floor's (at the read's
    // era), else the venue's drawing (a voxel kit or venue its blocks, an anime venue its cel discs), else the read's era
    // (gen-7 its bloom). The sixth generation's paint is the page's own: the juice as it was
    const atRigFidelity = async (fig) => {
      if (!fig || !fig.juice) return fig;
      const m = sketch.manifest, { rigFidelity } = await import('@/lib/graph/car-designer/juice.js');
      const fxs = m.fxStyle && typeof m.fxStyle === 'object' ? m.fxStyle : null;
      const floor = fxs && fxs.fidelity ? (await import('@/lib/graph/scene/juice-style.js')).fidelityOfRead(fxs.fidelity, era) : undefined;
      const v = m.scape && m.scape.venue, { STADIUM_PRESETS } = await import('@/lib/graph/stadium/stadium-words.js');
      const venueLook = typeof v === 'string' ? STADIUM_PRESETS[v]?.look : v && typeof v === 'object' ? v.look ?? STADIUM_PRESETS[v.preset]?.look : undefined;
      const f = rigFidelity({ floor, pole: m.kit && m.kit.pole, venueLook, era });
      return f === 'paint' ? fig : { ...fig, juice: { ...fig.juice, fidelity: f } };
    };
    if (figs && typeof figs === 'object') {
      payload.figures = {};
      let poseNames = null;
      // THE SCENES' TAKES (playscape/ui/scene-takes.js): a page whose scenes are written as scripts gives each figure that
      // plays in them its acts and face takes, blocked on the stage the scripts are lowered on below (lowerPlay). None ⇒
      // nothing is computed, byte-identical
      const { hasScripts } = await import('@/lib/graph/playscape/ui/scene-script.js');
      const takesOf = hasScripts(sketch.manifest.play) ? (await import('@/lib/graph/playscape/ui/scene-takes.js')).sceneTakes(sketch.manifest, { anchors: payload.anchors, player: Array.isArray(sketch.manifest.entities) ? deriveLevelPlayer(sketch.manifest).player : null }) : null;
      for (const [name, rawSpec] of Object.entries(figs)) {
        if (!rawSpec || typeof rawSpec !== 'object') continue;
        // meshRef entries were consumed by the bind-back block above (static
        // scenery lowered into payload.faces — not an entity body).
        if (typeof rawSpec.meshRef === 'string') continue;
        // HERO bodies (playscape/player.js): a figures-map entry may be a HERO, inline (`hero`: the hero door's spec, as
        // mint_solid({ kind: 'layered', via: 'hero', spec }) takes it) or STORED (`heroRef`: a layered hero sketch). It
        // resolves through the layered kind and hands over the packed rig the World page already plays as a
        // `figure-rig` body (station-loft-rig.js packLayeredRig: the same keys and blend as every rig body), without
        // the static solid or the clip preview. `clips` names which of the hero's clips plays each runtime state
        // ({ forward: 'run', idle: 'idleRelaxed', leap: 'leap' }): the body plays the hero's own clip under the
        // runtime's name. `library` names an outside animation library (figures/library: Quaternius's CC0 one ships)
        // whose clips, retargeted onto its rig, play the states `clips` hands to them (playerStates, when the world was
        // written: the library's for the states it names, the hero's own door gaits where it carries them). Absent ⇒
        // no hero is resolved, byte-identical.
        // (and a MODEL made elsewhere, `modelRef`: a rigged humanoid .glb bound onto a sketch, worn as a hero's pack is)
        if (rawSpec.hero || typeof rawSpec.heroRef === 'string' || typeof rawSpec.modelRef === 'string') {
          // (a composed juice floor's game type times the hero's swing: hero-swing.js swingTiming; the floor or none ⇒ its own)
          const fxs = sketch.manifest.fxStyle, swing = fxs && typeof fxs === 'object' ? (await import('@/lib/graph/scene/juice-style.js')).readJuiceStyle(fxs).flavor : null;
          // THE HELD STRIKE: a platform body playing this hero whose rule carries a feel's string (its contact window,
          // gameworld/feel/lower.js) and no strike of its own strikes with what the hero holds in its right hand: the
          // hero's swings as the runtime's swing directions (world-kinds.js), the rule armed with the item's reach, the
          // class's seconds and damage (any the rule names stand). Nothing held ⇒ the body as it was.
          // (an action hero sheathed out of combat plays `<hero>-sheathed` and draws this hero in a fight: held-strike.js)
          const wields = (e) => wieldsFigure(e, name);
          const wielder = (payload.entities || []).find(wields);
          // (a moveset's hero, whichever figure it plays now: its moves bake on every figure its weapons show, the
          // sheathed hero's fist as the drawn hero's blade, whatever the blade's bake has armed on it since)
          const mover = (payload.entities || []).find((e) => e && e.rule && e.rule.moveset && e.body && (e.body.figure === name || (e.rule.combat && (e.rule.combat.drawn === name || e.rule.combat.sheathed === name))));
          // THE RIDER (a world with `mounts`, worlds/mount-units.js): the pilot playing this hero learns to ride its horses, its
          // riding clips solved on its own rig in the pack (world-kinds.js ctx.ride). No mounts ⇒ the hero as it was
          const rider = mountsSpec && !mountRide ? (payload.entities || []).find((e) => e && e.pilotable && e.body && e.body.figure === name) : null;
          let ride = null;
          if (rider) {
            const { mountRiderSync } = await import('@/lib/graph/worlds/mount-units.js'), { mountRide: solve } = await import('@/lib/graph/mount/game.js');
            ride = (R, dz) => { mountRide = { sol: mountRiderSync(mountsSpec, { R, dz }, solve), riderId: rider.id }; return mountRide.sol.clips; };
          }
          // (a world a headset plays, its own `xr` or the page's `?xr=`: the hero's hands ride its figure, hero-xr-hands.js)
          const takes = takesOf?.[name] ?? null;
          const { held, ...figure } = await heroFigure(name, rawSpec, { swing, ...(sketch.manifest.figureGrade ? { grade: sketch.manifest.figureGrade } : {}), ...(wielder || mover ? { swings: { contact: (wielder || mover).rule.strikeContact, ...((wielder || mover).rule.moveset ? { body: true, ...movesOf((wielder || mover).rule, name) } : {}) } } : {}), ...(sketch.manifest.xr || viewOpts.xr ? { hands: true } : {}), ...(ride ? { ride } : {}), ...(takes ? { takes } : {}) });
          // (a body destroyed in it, `vanish.die` a dismantle or a cleave: each bone's parent rides the figure, the joints the
          // page's wreck cuts: figures/rig-tpose.js humanoidParents, read off the rest bones; a rig not a humanoid's, none)
          // (and one CLEAVED in it: its parts cut in two by a slash, scene/rig-cleave.js, seeded by the figure's name, the
          // cut capped in the inside its body names)
          const wrecked = (payload.entities || []).filter((e) => e && e.body && (e.body.figure === name || (Array.isArray(e.body.modes) && e.body.modes.some((m) => m && m.figure === name))) && wrecks(e));
          if (wrecked.length) {
            const { humanoidParents } = await import('@/lib/graph/figures/rig-tpose.js');
            try { figure.wreck = { parent: humanoidParents(figure.bones) }; } catch { figure.wreck = {}; }
            const cleaved = wrecked.find((e) => e.body.vanish && (e.body.vanish.die === 'cleave' || (e.body.vanish.die === 'destroy' && Object.values(e.body.vanish.by || {}).some((D) => D && D.die === 'cleave'))));
            if (cleaved) {
              const { slashPlane, cleaveFigure } = await import('@/lib/graph/scene/rig-cleave.js');
              let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 999983;
              figure.wreck.cleave = cleaveFigure(figure, { plane: slashPlane(figure.figH, { seed: h }), ...(cleaved.body.vanish.inside ? { inside: cleaved.body.vanish.inside } : {}) });
            }
          }
          // (the same game type's movement juice, a platformer's or pinball's: gameworld/feel/hero-juice.js, at the
          // fidelity a machine's takes; any other game type's hero as it was)
          const moves = swing ? (await import('@/lib/graph/gameworld/feel/hero-juice.js')).heroJuice(swing, figure) : null;
          payload.figures[name] = moves ? await atRigFidelity({ ...figure, juice: moves }) : figure;
          // THE POSE GRADE CUT IN (figure-grades.js): a play-grade world bakes the figures its close shots reach again at
          // the pose grade, `<name>@pose`, the page cutting it in while a close shot is on; two bakes that are not one
          // character (bones, clips, height) keep the play grade alone. Any other world: nothing more
          if (sketch.manifest.figureGrade === 'play' && !rawSpec.grade && (poseNames ??= (await import('@/lib/graph/figures/figure-grades.js')).poseCast(sketch.manifest)).has(name)) {
            const { held: _held, ...pose } = await heroFigure(name, { ...rawSpec, grade: 'pose' }, { swing, ...(wielder || mover ? { swings: { contact: (wielder || mover).rule.strikeContact, ...((wielder || mover).rule.moveset ? { body: true, ...movesOf((wielder || mover).rule, name) } : {}) } } : {}), ...(takes ? { takes } : {}) });
            const { crossGradeErrors } = await import('@/lib/graph/figures/figure-grades.js');
            if (!crossGradeErrors(pose, payload.figures[name]).length) { payload.figures[`${name}@pose`] = pose; payload.figures[name] = { ...payload.figures[name], pose: `${name}@pose` }; }
          }
          // (a moveset's hero whose figure carries its moves' own clips plays them: combat-melee.js `moveClips`)
          const moveClips = !!(figure.clips && Object.keys(figure.clips).some((k) => k.startsWith('mv_')));
          if (held) payload.entities = payload.entities.map((e) => (wields(e) ? armHeld(e, held, moveClips) : e));
          continue;
        }
        // RACER bodies (car-designer/roster.js): a figures-map entry may be a cartoon racer's recipe (`racer`: { facets,
        // brief?, seed, parts?, shade? }, what a quick race's field writes): the driver read off its Egocube sheet, its machine
        // solved from the parts library, delivered as the vehicle rig it bakes (its live overlay and juice with it).
        // Absent ⇒ no racer is resolved, byte-identical.
        if (rawSpec.racer && typeof rawSpec.racer === 'object') {
          const { racerOf } = await import('@/lib/graph/car-designer/roster.js');
          // (read in the form render, gen-7, a finished racer carries its materials for the page to light)
          payload.figures[name] = await atRigFidelity(racerOf(rawSpec.racer, { form: ERAS[era]?.surface === 'form' }).S.figure);
          continue;
        }
        // SUPERCAR bodies (car-designer/supercar-figure.js): a figures-map entry may be a composed supercar's recipe
        // (`supercar`: { preset?, seed?, surface?, mood? }, what a quick race's field of supercars writes), delivered as
        // its vehicle rig (live overlay and juice with it), lit in the race's mood when it names one.
        // Absent ⇒ no supercar is resolved, byte-identical.
        if (rawSpec.supercar && typeof rawSpec.supercar === 'object') {
          const { supercarFigure } = await import('@/lib/graph/car-designer/supercar-figure.js');
          // (read in the form render, gen-7, its body and wheels carry their materials for the page to light)
          payload.figures[name] = await atRigFidelity(supercarFigure(rawSpec.supercar, { form: ERAS[era]?.surface === 'form' }));
          continue;
        }
        // LOFT bodies (car-designer/realistic.js, the vehicle registry's realistic build): a figures-map entry may be a
        // road class's realistic loft (`loft`: { class, era?, brief?, seed?, light?, livery?, wear? }, what a quick ride at the realistic tier
        // writes), at its class's true numbers in metres, delivered as its vehicle rig (the hull the root, each wheel its
        // own bone). Absent ⇒ no loft is resolved, byte-identical.
        if (rawSpec.loft && typeof rawSpec.loft === 'object') {
          const { loftFigure } = await import('@/lib/graph/car-designer/race-families.js');
          // (read in the form render, gen-7, or asked for it by its light: its faces carry their materials for the page)
          // (a field vehicle lit as its world is: its sky, and wet when its weather is the wet family's; car-designer/military.js)
          const { STATES } = await import('@/lib/graph/weather/weather.js');
          const W = sketch.manifest.weather, wet = typeof W === 'string' && STATES[W]?.family === 'wet';
          payload.figures[name] = await atRigFidelity(loftFigure(rawSpec.loft, { form: ERAS[era]?.surface === 'form', setting: { sky: payload.sky ?? null, wet } }));
          continue;
        }
        // CRAFT bodies (craft-shelf/craft-form.js): a figures-map entry may be a craft off the shelf standing on its gear
        // (`craft`: { archetype, look?, livery?, wear?, fold?, pad?, made? }, what a parked helicopter, aircraft or drone
        // writes), in the form render, made unless `made: false`, lit by its world's sky, its rotors still; `pad` a
        // helipad under it. Absent ⇒ no craft is resolved, byte-identical.
        if (rawSpec.craft && typeof rawSpec.craft === 'object') {
          const { craftFormFigure } = await import('@/lib/graph/craft-shelf/craft-form.js');
          const K = rawSpec.craft;
          const opts = Object.fromEntries(['look', 'livery', 'wear', 'fold', 'pad'].filter((k) => K[k] !== undefined && K[k] !== false).map((k) => [k, K[k]]));
          payload.figures[name] = await atRigFidelity(craftFormFigure(K.archetype, { setting: { sky: payload.sky ?? null }, pose: { gear: 0 }, attitude: 'ground', made: K.made !== false, ...opts }));
          continue;
        }
        // CYCLE bodies (cycle-shelf/: the vehicle registry's realistic build of a machine ridden astride): a figures-map
        // entry may be a cycle shelf machine (`cycle`: { archetype, look?, pose?, addons? }, what a parked cycle writes), at
        // its class's true numbers in metres, parked on its stand, delivered as its rig (the machine the root, each wheel
        // a bone); or ridden (`ride: true`, rider?, posture?: what a quick game's ride writes), its rider astride and its
        // live overlay with it (its front steered, its lean). Absent ⇒ none is resolved, byte-identical.
        if (rawSpec.cycle && typeof rawSpec.cycle === 'object') {
          const { cycleFigure, cycleRideFigure } = await import('@/lib/graph/cycle-shelf/cycle-figure.js');
          payload.figures[name] = rawSpec.cycle.ride ? await cycleRideFigure(rawSpec.cycle) : cycleFigure(rawSpec.cycle);
          continue;
        }
        // CONSTRUCTION bodies (construction-shelf/: the vehicle registry's realistic build of a site machine): a figures-map
        // entry may be a construction shelf machine (`construction`: { archetype, pose?, tool?, carrier?, height?,
        // palette? }, what a parked site machine writes), at its class's true numbers in metres, at its pose (its rest
        // unless it says), centred on its spot, delivered as its rig (the machine the root). Absent ⇒ none is resolved,
        // byte-identical.
        if (rawSpec.construction && typeof rawSpec.construction === 'object') {
          const { conFigure } = await import('@/lib/graph/construction-shelf/con-figure.js');
          payload.figures[name] = conFigure(rawSpec.construction);
          continue;
        }
        // TRANSFORMER bodies (transformation/: more-than-meets): a figures-map entry may be a body in two forms
        // (`transformer`: { robot?, vehicle?, scheme?, fold?, legs?, height? }): the robot a VARIABLE SUIT (`robot.variable`:
        // { palette?, build? }, a suit drawn to fold into its own waverider), an ALIEN BODY (`robot.alien`, pointed shells
        // folding into a hover jetski), a stored suit (`robot.unitRef`, baked as
        // a unitRef is, its `targetH`/`aim`/`aimArms`/`swings`/`dodges` with it) or the inner frame made to the vehicle;
        // the vehicle a stored build (`vehicle.vehicleRef`), a ride, a racer, a supercar or a craft off the shelf, or
        // none (the suit's own flight form). Delivered as one rig figure carrying `forms`: the robot's clips, the
        // vehicle's, and the transformation between them. Absent ⇒ none is resolved, byte-identical.
        if (rawSpec.transformer && typeof rawSpec.transformer === 'object') {
          const T = rawSpec.transformer;
          const { bakeTransformer } = await import('@/lib/graph/transformation/index.js');
          let robot = T.robot && T.robot.variable ? { variable: T.robot.variable } : T.robot && T.robot.alien ? { alien: T.robot.alien } : { frame: (T.robot && T.robot.frame) || {} };
          if (T.robot && typeof T.robot.unitRef === 'string') {
            const { SketchRepository } = await import('@/lib/db/repositories/sketches');
            const src = SketchRepository.getByRef(T.robot.unitRef);
            if (!src || src.manifest?.kind !== 'assembler') throw new Error(`figures.${name}: transformer robot unitRef '${T.robot.unitRef}' is not a stored assembler unit`);
            const { bakeUnitRig } = await import('@/lib/graph/worlds/unit-rig.js');
            const R = T.robot;
            robot = { figure: bakeUnitRig(src.manifest, {
              keys: 12,
              targetH: Number.isFinite(R.targetH) ? R.targetH : null,
              aim: R.aim && typeof R.aim === 'object' ? R.aim : null,
              aimArms: (R.aimArms && typeof R.aimArms === 'object') || typeof R.aimArms === 'string' ? R.aimArms : null,
              swings: Array.isArray(R.swings) ? R.swings : null,
              dodges: Array.isArray(R.dodges) ? R.dodges : null,
            }) };
          }
          let vehicle = T.vehicle && typeof T.vehicle === 'object' ? T.vehicle : null;
          if (vehicle && typeof vehicle.vehicleRef === 'string') {
            const { SketchRepository } = await import('@/lib/db/repositories/sketches');
            const src = SketchRepository.getByRef(vehicle.vehicleRef);
            if (!src || src.manifest?.kind !== 'assembler') throw new Error(`figures.${name}: transformer vehicleRef '${vehicle.vehicleRef}' is not a stored assembler build`);
            const { bakeVehicleRig } = await import('@/lib/graph/vehicle-designer/vehicle-rig.js');
            vehicle = { figure: bakeVehicleRig(src.manifest, { keys: 12, targetH: 1.5 }) };
          }
          const { figure } = await bakeTransformer({ robot, vehicle, scheme: T.scheme, fold: T.fold, legs: T.legs, height: T.height });
          payload.figures[name] = figure;
          continue;
        }
        // figureRef: a figures-map entry may reference a STORED
        // kind:'figure' sketch instead of re-declaring the body — the entry inherits the
        // recipe's pose/proto/garment/motion and its own fields override. This is how a
        // figure minted once via create_figure is re-used across scenes; the world manifest
        // stays a tiny recipe (only the ref persists — resolution happens here at bake time).
        // vehicleRef: a figures-map entry may reference a stored
        // ASSEMBLER vehicle build — the vehicle rig derives from its veh-* garage blocks
        // (vehicle-designer/vehicle-rig.js: root + four wheel bones classified against the
        // chassis's axle sockets) and bakes as rig delivery with the single distance-true `roll`
        // clip, so the existing figure-rig body path renders it unchanged. EXPLICIT beside
        // unitRef — a car is not a biped; unitRef stays biped-only.
        if (typeof rawSpec.vehicleRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.vehicleRef);
          if (!src || src.manifest?.kind !== 'assembler') {
            throw new Error(`figures.${name}: vehicleRef '${rawSpec.vehicleRef}' is not a stored assembler build`);
          }
          const { bakeVehicleRig } = await import('@/lib/graph/vehicle-designer/vehicle-rig.js');
          payload.figures[name] = bakeVehicleRig(src.manifest, {
            keys: rawSpec.keys || 12,
            targetH: Number.isFinite(rawSpec.targetH) ? rawSpec.targetH : null,
          });
          continue;
        }
        // unitRef: a figures-map entry may
        // reference a stored ASSEMBLER unit — the biped rig derives from its
        // stations (unit-pose.js) and the body bakes as rig delivery only
        // (unit-rig.js): a suit is rigid parts by construction, and frame
        // stacks at unit face counts would dwarf the payload ceiling.
        if (typeof rawSpec.unitRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.unitRef);
          if (!src || src.manifest?.kind !== 'assembler') {
            throw new Error(`figures.${name}: unitRef '${rawSpec.unitRef}' is not a stored assembler unit`);
          }
          const { bakeUnitRig } = await import('@/lib/graph/worlds/unit-rig.js');
          // prelit: a unitRef figure may carry `prelit: '<ref>'`
          // naming a mesh-store binding whose GLB is a GI-baked TRANSFER bake of THIS suit's
          // rest faces (offline, via the mobile-suit pack's scripts/spike-prelit-suit.mjs --bind). We read it, build the
          // quantised position->colour map, and hand bakeUnitRig a recolour step that swaps the
          // rig's rest-face vexar colours for the baked GI colours before packing — so a
          // premium-lit suit WALKS (the moving twin of the meshRef statue). Colours come from the
          // binding, not the recipe (bound-derived-artifact posture, same as meshRef/giBake).
          // Absent → prelitFn is null and the bake is byte-identical (null skips the hook + keys the cache).
          let prelitFn = null, prelitKey = null;
          if (typeof rawSpec.prelit === 'string') {
            const { latestBoundMesh } = await import('@/lib/graph/scene/mesh-store.js');
            const bound = latestBoundMesh(rawSpec.prelit);
            if (!bound) throw new Error(`figures.${name}: prelit '${rawSpec.prelit}' has no bound mesh — bake+bind one first (spike-prelit-suit.mjs --bind)`);
            const { readBoundMeshFaces } = await import('@/lib/graph/scene/scene-gltf-read.js');
            const { buildPosMap, recolourNormFaces } = await import('@/lib/graph/worlds/prelit-transfer.js');
            // prelitKey lets bakeUnitRig CACHE this bake (bind slots are append-only, so the
            // path names the bake content — a re-bind mints mesh-<n+1>.glb and re-keys). The
            // posMap build is LAZY (a rig-cache hit never touches the GLB) and memoized per
            // path, so a cache miss under different bake opts (space clips, a preview card)
            // re-reads nothing.
            prelitKey = bound.path;
            prelitFn = (normFaces, _boneList, scale) => { recolourNormFaces(normFaces, posMapFor(bound.path, readBoundMeshFaces, buildPosMap), scale); };
          }
          const baked = bakeUnitRig(src.manifest, {
            prelit: prelitFn,
            prelitKey,
            keys: rawSpec.keys || 12,
            targetH: Number.isFinite(rawSpec.targetH) ? rawSpec.targetH : null,
            frame: rawSpec.frame === true || (rawSpec.frame && typeof rawSpec.frame === 'object') ? rawSpec.frame : false,
            // frameOnly (skinless read): bake JUST the generated inner frame — the
            // stick figure of the derived rig — with none of the suit's armor, so
            // the walk (and every clip) can be examined without any livery. Same
            // bones/clips/grounding as a full bake; only the skin is stripped.
            frameOnly: rawSpec.frameOnly === true || (rawSpec.frameOnly && typeof rawSpec.frameOnly === 'object') ? rawSpec.frameOnly : false,
            // pose (posing studio): hold one authored DOF static instead of the gait, so a
            // clock world freezes the suit in it — the clean surface for posing from scratch.
            pose: rawSpec.pose && typeof rawSpec.pose === 'object' ? rawSpec.pose : null,
            // aim (armed walkers): an arm-dof object locks the arms — and any
            // weapon station rigid with them — into a stabilized hold through
            // every clip (unit-rig.js aimLockClips).
            aim: rawSpec.aim && typeof rawSpec.aim === 'object' ? rawSpec.aim : null,
            // aimArms (per-arm lock mode): hold ONE arm on the aim while the other
            // swings with the gait (geof: left vulcan hand held, right sword hand
            // free). A string or { L, R } of 'lock'|'hold'|'free'; absent → both lock.
            aimArms: (rawSpec.aimArms && typeof rawSpec.aimArms === 'object') || typeof rawSpec.aimArms === 'string' ? rawSpec.aimArms : null,
            // swings (melee): pack swing-shelf names (mobile-suit/unit-swings.js) baked as unlocked swing_<name>
            // clips beside the aim-locked gait — the strike verbs.
            swings: Array.isArray(rawSpec.swings) ? rawSpec.swings : null,
            // dodges (acrobatic dodge): DODGE_POSES names baked as unlocked
            // maneuver clips beside the gait — the tuck/pike/spin tumble shapes.
            dodges: Array.isArray(rawSpec.dodges) ? rawSpec.dodges : null,
            // space (R18, the second play mode): swap the ground gait clips for
            // thrust poses + add ascend/descend, so a floating suit thrusts
            // instead of walking (pairs with the platform rule's `space:true`).
            space: rawSpec.space === true,
            // weldOffHand (left-arm control spike): weld the LEFT (off-hand) arm to
            // the chest so it holds a constant shape and turns only with the torso,
            // instead of being posed by shL/elbowL/aim/injection.
            weldOffHand: rawSpec.weldOffHand === true,
            // noWeapons (skin/livery previews): drop the weapon + shield riders so the
            // bake reads as the bare suit — the paint, not the gun. Body/prelit untouched.
            noWeapons: rawSpec.noWeapons === true,
            // material (specular finish): a uniform clear-coat over every body panel so
            // the suit catches a live highlight (material-response specular channel). A
            // material-shelf ref (preset name / '#hex' / object). Diffuse-preserving, so
            // only the highlight is added; absent → byte-identical. Role-differentiated
            // finishes come from re-minting through the g/z livery `material:true`.
            material: rawSpec.material != null ? rawSpec.material : null,
            // contrast: opt-in role-based material-contrast
            // treatment (value separation + finishes + rim). No game world sets this
            // until the treatment passes its eyes gate; absent → byte-identical.
            contrast: rawSpec.contrast != null ? rawSpec.contrast : null,
            // ao (covered-parts shading): opt-in rest-pose ambient-occlusion bake over the
            // whole body (unit-rig.js), darkening sections armor covers — bicep under
            // pauldron, thigh under skirt. `true` or { radius, strength, minAo, steps };
            // absent → byte-identical bake.
            ao: rawSpec.ao != null ? rawSpec.ao : null,
            // shade (manual covered-parts shading): the hand-authored, near-zero-cost
            // sibling of `ao` — fixed per-bone gradient bands (bicep/thigh tops, abdomen).
            // `true` or { strength, bands }; absent → byte-identical bake.
            shade: rawSpec.shade != null ? rawSpec.shade : null,
            // UNSHADED (flat-albedo export): FLAT_LIGHT threads through the rig's own
            // lowerAssemblerBuild bake (unit-rig → workbench-assembler), and every baked
            // darkening pass is forced OFF, so the suit exports at raw livery albedo. The
            // keys are added ONLY when unshaded, so the default-path opts object — and thus
            // the RIG_CACHE key — is byte-identical.
            ...(unshaded ? { light: ctx.light, ao: false, shade: false, contrast: null, material: null } : {}),
          });
          // previewClip (eyes-gate): alias a baked maneuver clip onto `forward`
          // so an ambient clock world HOLDS that pose — the dodge shapes are
          // static, so the clock just displays them. Resolve-time only; the
          // emitted page bytes are unchanged (no char re-pin), and worlds that
          // don't set it are byte-identical.
          if (typeof rawSpec.previewClip === 'string' && baked.clips[rawSpec.previewClip]) {
            baked.clips = { ...baked.clips, forward: baked.clips[rawSpec.previewClip] };
          }
          payload.figures[name] = baked;
          continue;
        }
        // polygomerRef: a figures-map entry may reference a stored
        // kind:'manji-tree' POLYGOMER (a dreamed creature/object). It bakes to a STATIC face mesh —
        // no gait clips: a polygomer has no rig and animates by squash/stretch (driven in the
        // renderer off the platform rule's grounded/jumped/landed edges). This is how a round,
        // Kirby-style dreamed hero becomes a walking entity body. The world manifest stays a ref.
        if (typeof rawSpec.polygomerRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.polygomerRef);
          if (!src || src.manifest?.kind !== 'manji-tree') {
            throw new Error(`figures.${name}: polygomerRef '${rawSpec.polygomerRef}' is not a stored manji-tree polygomer`);
          }
          const { resolveManjiTreeLathes } = await import('@/lib/graph/worlds/polygomer-world.js');
          const { lowerObjectFaces, WORKBENCH_LIGHT } = await import('@/lib/graph/worlds/workbench.js');
          payload.figures[name] = { polygomer: true, faces: lowerObjectFaces({ lathes: resolveManjiTreeLathes(src.manifest) }, WORKBENCH_LIGHT) };
          continue;
        }
        let spec = rawSpec;
        if (typeof rawSpec.figureRef === 'string') {
          const { SketchRepository } = await import('@/lib/db/repositories/sketches');
          const src = SketchRepository.getByRef(rawSpec.figureRef);
          if (!src || src.manifest?.kind !== 'figure') {
            throw new Error(`figures.${name}: figureRef '${rawSpec.figureRef}' is not a stored figure sketch`);
          }
          const { figureRef, ...own } = rawSpec;
          const m = src.manifest;
          spec = {
            ...(m.pose ? { pose: m.pose } : {}),
            ...(m.proto ? { proto: m.proto } : {}),
            ...(m.garment ? { garment: m.garment } : m.outfit ? { garment: manifestGarment(m) } : {}),   // an `outfit` figure hands the world its lowered garments
            ...(m.motion ? { motion: m.motion } : {}),
            ...own,
          };
        }
        // RIG delivery (renderer-ladder P2 rung 2): `delivery:'rig'` bakes pose CURVES + rigid
        // parts (rig-bake.js) instead of frame stacks — orders of magnitude smaller, continuous
        // poses, head-look-at capable. `asset:'megaboy'` routes to the FK builder; anything
        // else is the protoform pipeline. Default (no delivery field) stays figure-frames.
        if (spec.delivery === 'rig') {
          const { bakeMegaBoyRig, bakeProtoformRig } = await import('@/lib/graph/figures/rig-bake.js');
          payload.figures[name] = spec.asset === 'megaboy'
            ? await bakeMegaBoyRig({ keys: spec.keys || 8 })
            : await bakeProtoformRig({ proto: spec.proto, garment: spec.garment, keys: spec.keys || 8, motion: spec.motion || 'walk' });
        } else {
          payload.figures[name] = renderFigureWorldFrames(spec, spec.frames || 24).frames;
        }
      }
      // I4: record each figures-map entry's manifest-level body
      // source so the GLB export can stamp `moj:body` extras on entity nodes. Payload-only
      // metadata — emitThreeWorld destructures known keys and ignores this, so no emitted
      // page changes; no ref-sourced figures ⇒ field absent.
      const figureSources = {};
      for (const [name, rawSpec] of Object.entries(figs)) {
        if (!rawSpec || typeof rawSpec !== 'object') continue;
        const refKey = ['unitRef', 'figureRef', 'vehicleRef', 'polygomerRef', 'meshRef', 'heroRef', 'modelRef']
          .find((k) => typeof rawSpec[k] === 'string');
        if (refKey) figureSources[name] = `${refKey}:${rawSpec[refKey]}`;
      }
      if (Object.keys(figureSources).length) payload.figureSources = figureSources;
      // MODES (a body's `modes`, worlds/controllable/vanish.js): each mode's figure carries what it SHEDS when defeated into
      // the next (scene/rig-shed.js: its triangles the next lacks, bone by bone). None ⇒ the figures as they were
      const moded = (payload.entities || []).filter((e) => e && e.body && Array.isArray(e.body.modes) && e.body.modes.length > 1);
      if (moded.length) {
        const { shedParts } = await import('@/lib/graph/scene/rig-shed.js');
        for (const e of moded) e.body.modes.slice(0, -1).forEach((m, i) => {
          const A = payload.figures[m.figure], B = payload.figures[e.body.modes[i + 1].figure];
          if (A && B && A.rig && B.rig && !(A.shed && A.shed[e.body.modes[i + 1].figure])) A.shed = { ...(A.shed || {}), [e.body.modes[i + 1].figure]: shedParts(A, B) };
        });
      }
    }
    // GLYPH bodies (U1): body:{type:'glyph', form, tint?, scale?}
    // lowers here to a single-frame figure-frames body + a generated `glyph:<form>` clip — the
    // form shelf addressable by name, no emitter changes. No glyph bodies ⇒ payload untouched.
    const glyphLowered = lowerGlyphBodies(payload.entities, payload.figures);
    if (glyphLowered) {
      payload.entities = glyphLowered.entities;
      payload.figures = glyphLowered.figures;
    }
  }
  // a stage's HERDS (era/biocube-fauna.js placeHerds, a biocube's `fauna.herds`): its animals laid after the world's own
  // entities, each species' rig built once (worlds/fauna-units.js). None ⇒ payload untouched.
  if (payload && 'faunaUnits' in payload) await lowerFaunaUnits(payload);
  // a world's MOUNTS (worlds/mount-units.js: its `mounts`): the horses laid after its entities, their coats' figures, the
  // hero who rides them marked (its riding clips packed above). None ⇒ payload untouched.
  if (payload && mountsSpec) await (await import('@/lib/graph/worlds/mount-units.js')).lowerMounts(payload, mountsSpec, mountRide?.sol ?? null, { riderId: mountRide?.riderId ?? null });

  // generic, opt-in figure WEATHERING (materials/procedural-material.js `weatherRigParts`): the suit
  // analog of the face `material` channel. `weathering: true` (or `{ amt, seed }`) modulates every rig
  // figure's baked per-vertex colour buffers by the rust/grime field — livery colours stay the base,
  // weathering reads on top. Runs AFTER figures are baked (parts exist). Absent ⇒ figures untouched.
  // UNSHADED skips this: weathering modulates baked figure colours by a rust/grime DARKENING
  // field — a flat-albedo export keeps the base livery.
  if (payload && !unshaded && sketch.manifest.weathering && payload.figures && typeof payload.figures === 'object') {
    const w = sketch.manifest.weathering;
    const opts = w && typeof w === 'object' ? w : {};
    for (const key of Object.keys(payload.figures)) {
      const fig = payload.figures[key];
      if (fig && Array.isArray(fig.parts)) weatherRigParts(fig.parts, opts);
    }
  }

  // fx channel (U2): standing states + one-shot gestures on entities by
  // id. The stored /world path threads it here (emitThreeWorld reads `fx` from `...payload`); absent
  // ⇒ untouched. Carries hand-authored fx AND the U5 mechanic decoration merged above.
  if (payload && sketch.manifest.fx && typeof sketch.manifest.fx === 'object') {
    payload.fx = sketch.manifest.fx;
  }

  // MECHANICS lowering (M1): if the level's `game` channel declares
  // `mechanics` (+ an optional `fall` policy), lower them ONCE here — into an events fragment
  // (zones/reactions/watches/timers/hud/vars, onto the M0-pre zone fact source) merged into the
  // manifest's own events, and into synthesized contract fragments (produces/on/consumes/audits)
  // merged into the game channel below. The author declares verbs; the plumbing is generated. The
  // store isn't known at level-resolve, so mechanics NAME their slices (into:'bag'); create_game
  // re-validates the synthesized contract against the game's actual store. Deterministic + pure.
  let mechEvents = null;
  if (payload && sketch.manifest.game && Array.isArray(sketch.manifest.game.mechanics) && sketch.manifest.game.mechanics.length) {
    const synth = synthesizeLevel(sketch.manifest);   // lower mechanics → events + synthesized contract
    mechEvents = synth.mechEvents;
    // U5 decoration: drop the box markers the glyphs replaced, and add the per-pickup burst signal
    // reactions — so the decoration's fx.on bindings (above) fire on collect.
    if (mechEvents && decorSuppress && decorSuppress.size && Array.isArray(mechEvents.entities)) {
      mechEvents.entities = mechEvents.entities.filter((e) => !(e && decorSuppress.has(e.id)));
    }
    if (mechEvents && decorReactions && decorReactions.length) {
      mechEvents.reactions = [...(Array.isArray(mechEvents.reactions) ? mechEvents.reactions : []), ...decorReactions];
    }
    // stash the synthesized contract onto a working copy of the game channel for the block below
    sketch = { ...sketch, manifest: { ...sketch.manifest, game: synth.game } };
  }

  // generic, opt-in EVENTS channel: the in-world bus. A manifest may carry an
  // `events` block ({ sources, reactions, sequences, initial, entities }) — declarative reactions
  // that turn physics FACTS (contact/rest) and timers into meaning (spawn/toggle/move/emit), and
  // reach back into physics via the 5b bridge. It rides on top of any kind (typically alongside
  // `physics`), so it is gated on an existing payload. Present (reactions or sequences) ⇒ a LIVE
  // channel the static stills can't run, so `nonBakeable` (the /svg + /scene degrade to frame zero).
  // Mechanics-lowered events (mechEvents) merge in here so the one bus runs both.
  // A `play` block (playscape/ui/direction.js) lowers its parts (and its cues' words) to hud rows after the hand rows and
  // before the mechanics' (so a hand row still restyles either by naming its var), and brings its
  // direction's tokens and dials (the greybox while the direction waits on approval). A hand-written
  // events.style wins over the play block's. Its cues (playscape/ui/cues.js) bring their reactions, watches, zones
  // and sequences beside it. Absent `play` ⇒ not a byte changes.
  const playEv = payload && sketch.manifest.play ? lowerPlay(sketch.manifest, { anchors: payload.anchors, player: Array.isArray(sketch.manifest.entities) ? deriveLevelPlayer(sketch.manifest).player : null }) : null;
  const { style: _playStyle, register: _playRegister, menus: _playMenus, cast: _playCast, looks: _playLooks, scenes: _playScenes, quests: _playQuests, library: _playLibrary, rpg: _playRpg, minigames: _playMini, ...playBus } = playEv || {};
  let ev = payload && mergeEventManifests(mergeEventManifests(sketch.manifest.events, Object.keys(playBus).length ? playBus : null), mechEvents);
  // (a level whose play is a library alone has no bus of its own yet: the shelf still needs the page's)
  if (!ev && payload && playEv && playEv.library) ev = {};
  if (ev && playEv) {
    if (playEv.style && ev.style === undefined) ev = { ...ev, style: playEv.style };
    if (playEv.register) ev = { ...ev, register: playEv.register };
    if (playEv.menus) ev = { ...ev, menus: playEv.menus };
    if (playEv.scenes) ev = { ...ev, scenes: playEv.scenes };   // the scene runner's program (playscape/ui/scenes.js)
    if (playEv.quests) ev = { ...ev, quests: playEv.quests };   // the quests' journal (playscape/ui/quests.js)
    if (playEv.library) ev = { ...ev, library: playEv.library };   // the library's shelf (playscape/ui/library.js)
    if (playEv.cast) ev = { ...ev, cast: true };
    if (playEv.looks) ev = { ...ev, looks: playEv.looks };
    // the stats kernel's cfg is not a channel the merge carries: a world with its own events (a player world's controls
    // legend) would otherwise lose it
    if (playEv.stats) ev = { ...ev, stats: playEv.stats };
    if (playEv.rpg) ev = { ...ev, rpg: playEv.rpg };   // the battle kernel's cfg (playscape/rpg), the same way
    if (playEv.minigames) ev = { ...ev, minigames: playEv.minigames };   // the games inside the game (playscape/ui/minigames.js)
  }
  // a mechanic that moves the cast (waves: spawn and walk on the ctrl verb) reaches the characters as a play's cues do
  const ctrlIn = (list) => Array.isArray(list) && list.some((r) => r && r.do === 'ctrl');
  if (ev && !ev.cast && mechEvents && (ctrlIn(mechEvents.reactions) || (mechEvents.sequences || []).some((q) => ctrlIn(q && q.steps)))) ev = { ...ev, cast: true };
  // A HUD-only block (a `legend` idiom: the controls hint) is a live channel too: it paints and fades on the page.
  // (So is a library alone: its shelf is the page's, with no rule of its own.)
  if (ev && ((Array.isArray(ev.menus) && ev.menus.length) || (Array.isArray(ev.reactions) && ev.reactions.length) || (Array.isArray(ev.sequences) && ev.sequences.length) || (Array.isArray(ev.hud) && ev.hud.length) || (Array.isArray(ev.library) && ev.library.length))) {
    // the HUD widget language (hud-widgets.js): rows are validated here so a bad slot / kind /
    // token fails the compose_world resolve gate with a teaching message instead of painting
    // wrong; the events channel normalizes again at emit (idempotent), so fixtures stay raw.
    if (Array.isArray(ev.hud) && ev.hud.length) {
      // a row's text may name a word in the world's language ('@fight': game/title-words.js, the dashboard's own
      // catalogs); the world's `locale` is read only when a row does, so a world without one is never gated on it
      if (hasTitleWords(ev.hud)) ev = { ...ev, hud: localizeHudRows(ev.hud, readTitleLocale(sketch.manifest.locale, 'locale')) };
      // a title row without a theme gets the one its game implies (hud-widgets.js titleThemeFor: the composed juice floor's
      // register and game type; none ⇒ the arcade announcer), written onto the row so the emitter reads the same
      if (ev.hud.some((r) => r && r.as === 'title' && r.theme === undefined)) {
        const fxs = sketch.manifest.fxStyle;
        const juice = fxs === true ? { register: 'anime', flavor: 'action' } : fxs && typeof fxs === 'object' ? (await import('@/lib/graph/scene/juice-style.js')).readJuiceStyle(fxs) : null;
        const theme = titleThemeFor(juice);
        ev = { ...ev, hud: ev.hud.map((r) => (r && r.as === 'title' && r.theme === undefined ? { ...r, theme } : r)) };
      }
      // the cascade: a settled play direction's register dresses the title rows (hud-widgets.js titleDials)
      const h = normalizeHud(ev.hud, { register: ev.register });
      if (h.errors.length) throw new Error(`events.hud is invalid — see get_game_vocab({ id: 'hud-guide' }):\n- ${h.errors.join('\n- ')}`);
      // the carved banners (`as: 'title'`, game/title-carve.js): their words carved here into the glyph atlas the page lays
      // out (events.titles); a title the host cannot carve (no font, a shaped script, a character no face covers) stays a
      // banner — the DOM spells it — and says why in events.titlesFallback. A world without a title row is untouched.
      const carved = carveTitles(h.widgets);
      if (carved) {
        const { fallback, ...atlas } = carved;
        const down = new Set(fallback.map((f) => `${f.on}\u0000${f.text}`));
        const hud = down.size ? ev.hud.map((r) => (r && r.as === 'title' && down.has(`${r.on}\u0000${r.text}`) ? { ...r, as: 'banner' } : r)) : ev.hud;
        // the look the letters are baked in: the composed juice floor's register (anime unless it says western)
        const fxs = sketch.manifest.fxStyle, register = fxs && typeof fxs === 'object' && fxs.register === 'western' ? 'western' : 'anime';
        ev = { ...ev, hud, ...(Object.keys(atlas.styles).length ? { titles: { ...atlas, register } } : {}), ...(fallback.length ? { titlesFallback: fallback } : {}) };
      }
    }
    if (ev.style !== undefined) {
      const se = validateHudStyle(ev.style, 'events.style');
      if (se.length) throw new Error(`events.style is invalid — see get_game_vocab({ id: 'hud-style' }):\n- ${se.join('\n- ')}`);
    }
    // the fades its downed bodies go by (a body's `vanish`, gameworld/vanish.js), played by the page's events. A world
    // with no events has no page to play them on, and its downed bodies simply go
    const vanish = Array.isArray(sketch.manifest.entities) ? [...new Set(sketch.manifest.entities.map((e) => e && e.body && e.body.vanish && e.body.vanish.is).filter((k) => typeof k === 'string'))] : [];
    if (vanish.length) ev = { ...ev, vanish };
    // and how a summoner's summons arrive (its call's transit, worlds/controllable/summon.js)
    const arrive = Array.isArray(sketch.manifest.entities) ? [...new Set(sketch.manifest.entities.map((e) => e && e.rule && e.rule.summon && e.rule.summon.with).filter((k) => typeof k === 'string'))] : [];
    if (arrive.length) ev = { ...ev, arrive };
    // and whether one of them is DESTROYED (its `vanish.die` a dismantle or a cleave): the page's wreck plays its pieces
    if (Array.isArray(sketch.manifest.entities) && sketch.manifest.entities.some(wrecks)) ev = { ...ev, wreck: true };
    // and whether it has LAYER-0 foes (a body with modes, or born under a state: docs/foes.md): a look laid on a foe is laid
    // on the body it wears now, given the normals a rig body lacks
    if (Array.isArray(sketch.manifest.entities) && sketch.manifest.entities.some((e) => e && ((e.body && ((Array.isArray(e.body.modes) && e.body.modes.length > 1) || e.body.born)) || (e.rule && e.rule.pair)))) {
      // (and each status a body is born under, its look drawn as a cue's would be: foes/states.js; and the power-up a
      // pair's survivor takes on when its partner falls: worlds/controllable/pair.js)
      const raged = sketch.manifest.entities.some((e) => e && e.rule && e.rule.pair && e.rule.pair.down === 'enrage') ? ['power-up'] : [];
      const born = [...new Set([...sketch.manifest.entities.flatMap((e) => (e && e.body && e.body.born && e.body.born.statuses ? Object.keys(e.body.born.statuses) : [])), ...raged])];
      const { LOOKS } = born.length ? await import('@/lib/graph/playscape/elements/elements.js') : { LOOKS: {} };
      // (a state may leave its look's coat off, `coat: false`: a foe's flaming, whose fire is its look)
      const coatless = (n) => sketch.manifest.entities.every((e) => !(e && e.body && e.body.born && e.body.born.statuses && e.body.born.statuses[n]) || e.body.born.statuses[n].coat === false);
      const bornLooks = Object.fromEntries(born.filter((n) => LOOKS[n] && !(ev.looks && ev.looks[n])).map((n) => [n, coatless(n) ? { ...LOOKS[n], coat: false } : LOOKS[n]]));
      ev = { ...ev, layer0: true, ...(born.length ? { born, looks: { ...(ev.looks || {}), ...bornLooks } } : {}) };
    }
    payload.events = await fxOnto(ev);   // (its effects' light and style, laid on the events the cues made)
    payload.nonBakeable = true;
  }

  // generic, opt-in WALK camera: any world may set `walk: true` (or a config object) to offer the
  // emitThreeWorld first-person Fly/Walk navigation (WASD + pointer-lock look, ground-snap, wall
  // collision against the scene `solids`). Needed by controllable game worlds you move THROUGH — e.g.
  // a laser range. Additive; absent ⇒ orbit only.
  // A kind whose resolver reads the manifest's walk itself (`ownsWalk`: the floorplan family) has already made
  // it the payload's, framed and in the world (its spawn reflected out of the plan frame); laying the raw
  // manifest value over it would put the spawn back in the plan.
  if (payload && sketch.manifest.walk && !desc.ownsWalk) payload.walk = sketch.manifest.walk;

  // generic, opt-in WebXR: `xr: true` (or { eye, speed, snap })
  // adds an immersive-vr entry to the live /world page — a headset walks the same scene, no engine.
  // Additive; absent ⇒ the emitted page is byte-identical. Stills ignore it.
  if (payload && sketch.manifest.xr) payload.xr = sketch.manifest.xr;

  // generic, opt-in volumetric FOG: an outdoor world may set
  // `fog: true` (or a tuning object: { density, height, color, maxDist, ... }) to composite a
  // ground-hugging volumetric fog over the rasterized mesh — a raymarched overlay that clips against
  // the world's solids via a grid-culled scene SDF (see composeVolumeFog + docs/raymarch-effects-layer.md).
  // Only kinds whose registry descriptor declares a `fogBoxes` extractor carry it; it renders ONLY on
  // the live /world (three.js) path — the /svg + /scene stills ignore `payload.fog`. Additive; absent
  // ⇒ no fog.
  if (payload && sketch.manifest.fog && typeof desc.fogBoxes === 'function') {
    const boxes = desc.fogBoxes(sketch.manifest);
    if (boxes && boxes.length) {
      const opts = (sketch.manifest.fog && typeof sketch.manifest.fog === 'object') ? sketch.manifest.fog : {};
      payload.fog = composeVolumeFog(boxes, { up: 'z', ...opts });
    }
  }

  // generic, opt-in CLOUD DECK (fog's sibling, salvaged from the smoke-and-cloud spike): an outdoor
  // world may set `clouds: true` (or a tuning object: { mode: 'undershot' | 'full', base, top,
  // coverage, sun, color, density, ... }) to composite a lit cloud deck over the rasterized mesh
  // through the effects[] overlay seam (see composeCloudDeck + docs/raymarch-effects-layer.md). The
  // gate is fog's, widened: kinds whose registry descriptor declares `fogBoxes` (the band defaults to
  // above their tallest box, and `full` mode clips behind the boxes that cross it) or `clouds: true`
  // (no solids: painted-landscape). Either way the band also clears the mesh's tallest vertex. The sun
  // follows the world's baked light when it has one above the horizon. Renders ONLY on the live /world
  // path; the layer publishes its band as `meta.base` / `meta.top`. Additive; absent ⇒ no layer,
  // byte-identical.
  if (payload && sketch.manifest.clouds && (typeof desc.fogBoxes === 'function' || desc.clouds === true)) {
    const boxes = typeof desc.fogBoxes === 'function' ? (desc.fogBoxes(sketch.manifest) || []) : [];
    const c = sketch.manifest.clouds;
    const opts = (c && typeof c === 'object' && !Array.isArray(c)) ? c : {};
    const toLight = payload.light && Array.isArray(payload.light.toLight) && payload.light.toLight.length === 3 && payload.light.toLight[2] > 0.05
      ? payload.light.toLight : null;
    let floor = 0;
    for (const face of (Array.isArray(payload.faces) ? payload.faces : [])) {
      for (const corner of (face && Array.isArray(face.corners) ? face.corners : [])) if (Number.isFinite(corner[2]) && corner[2] > floor) floor = corner[2];
    }
    const deck = composeCloudDeck(boxes, { up: 'z', floor, ...(toLight ? { sun: toLight } : {}), ...opts });
    payload.effects = [...(Array.isArray(payload.effects) ? payload.effects : []), deck];
  }

  // SFX channel (geometry sfx backend, 2026-07-08). A manifest
  // `sfx: [{ verb, at:[x,y,z] | on:'<entityId>', color?, rate?, size?, params? }]` renders the "juice"
  // verb shelf (sparkle / heal / ward / aura / beacon / …) as ADDITIVE SPRITES — one sprite per bead,
  // moved each frame along the verb's path — NOT a fullscreen raymarch overlay (the overlay was
  // retired for game sfx: perf drain too severe). An `on` id resolves to that entity's transform.pos;
  // deferred verbs (kokusen/ssj-aura, which absorb light) drop. Absent ⇒ payload untouched.
  if (payload && Array.isArray(sketch.manifest.sfx) && sketch.manifest.sfx.length) {
    const { resolveSpriteSfxLayers } = await import('@/lib/graph/game/glyph-sfx-sprites');
    const layers = resolveSpriteSfxLayers(sketch.manifest.sfx, sketch.manifest.entities);
    if (layers.length) payload.spriteSfx = layers;
  }

  // generic, opt-in WEATHER channel: the world's sky (weather/weather.js). A manifest may carry `weather` (a climate's
  // name, or { climate, dwell?, blend?, start?, surface? }): the page eases its fog, falls rain, snow, dust or petals
  // round the camera and lights the storms, every moment a pure function of the world clock and the seed (the
  // manifest's, else the sketch ref's). Live only (the stills ignore it, and are not degraded: no frame is missing).
  // Additive; absent ⇒ the emitted page is byte-identical.
  // A level with a CLOCK (the clock mechanic) has a sky that turns with it: night darkens it, and its seasons swap the
  // climate. It takes the weather even when the manifest names none (clear air).
  const clockMech = sketch.manifest.game && Array.isArray(sketch.manifest.game.mechanics) ? sketch.manifest.game.mechanics.find((m) => m && m.kind === 'clock') : null;
  // (a roadway in a wet mood brings its rain when the manifest names no weather: roads/race-mood.js)
  const moodWeather = sketch.manifest.kind === 'roadway' && typeof sketch.manifest.mood === 'string' && sketch.manifest.weather == null ? (await import('@/lib/graph/roads/race-mood.js')).RACE_MOODS[sketch.manifest.mood]?.weather ?? null : null;
  const weatherSpec = sketch.manifest.weather ?? moodWeather;
  if (payload && ((weatherSpec != null && weatherSpec !== false) || clockMech)) {
    const seed = Number.isFinite(Number(sketch.manifest.seed)) ? Number(sketch.manifest.seed) : seedOfRef(sketch.ref);
    const W = readWeather(weatherSpec != null && weatherSpec !== false ? weatherSpec : { climate: { clear: 1 } }, 'weather');
    // the air is the STYLE's (era/air.js: fog colour and body, the shade, what a state's air is): a kit's style card, or a
    // sixth-gen look's reference; a world with neither gets one made of its haze at emit. `weather.air` tunes either.
    const kit = sketch.manifest.kit ?? (sketch.manifest.stage && sketch.manifest.stage.kit);
    let air = null;
    if (kit) air = (await import('@/lib/graph/gameworld/style-guide')).airOfKit(kit, W.air);
    if (!air && sketch.manifest.look) {
      const ref = resolveLookSpec(sketch.manifest.look).ref;
      air = airCard({ air: ref.air, light: ref.light }, W.air);
    }
    // (one wind: a physical level's air, or the cube's wind, carries its rain and snow its way; any other world keeps the
    // seeded heading it always had)
    const wd = payload.rupa && payload.rupa.wind ? payload.rupa.wind.dir : (() => { const cw = geocubeWindOf(sketch.manifest); return cw ? (cw === true ? 0 : cw.dir ?? 0) : undefined; })();
    const heading = wd === undefined ? undefined : Array.isArray(wd) ? Math.atan2(wd[1], wd[0]) : (wd * Math.PI) / 180;
    payload.weather = { weather: W, seed, ...(air ? { air } : {}), ...(heading !== undefined ? { heading: Math.round(heading * 1e6) / 1e6 } : {}) };
    if (clockMech) {
      // the seasons' climates, in turn (spring, summer, autumn, winter unless the clock names its own)
      const climates = Number.isInteger(clockMech.seasons) && clockMech.seasons > 0 ? (Array.isArray(clockMech.climates) && clockMech.climates.length === 4 ? clockMech.climates : SEASON_CLIMATES) : null;
      payload.weather = { ...payload.weather, clock: true, ...(climates ? { seasons: climates.map((c, k) => readWeather(c, `game.mechanics.clock.climates[${k}]`)) } : {}) };
    }
  }

  // the PIXEL look (`pixel`: 2 to 8, how many screen pixels a drawn one covers): the page draws small and blows it up
  // without smoothing. Absent: the page's own resolution, every byte as it was.
  if (payload && sketch.manifest.pixel !== undefined && sketch.manifest.pixel !== false) {
    const k = sketch.manifest.pixel === true ? 4 : sketch.manifest.pixel;
    if (!(Number.isInteger(k) && k >= 2 && k <= 8)) throw new Error(`pixel is true or 2 to 8 (screen pixels a drawn one covers), not ${JSON.stringify(sketch.manifest.pixel)}`);
    payload.pixel = { scale: k };
  }

  // the ENDLESS RUNNER (worlds/controllable/runner.js): the pilot runs on its own down lanes, the rows laid ahead of it
  // as it plays; the page carries the runner's engine and view only then. Absent: every byte as it was.
  if (payload && sketch.manifest.runner != null && sketch.manifest.runner !== false) payload.runner = readRunner(sketch.manifest.runner);

  // the GRADE (scene/channels/grade.js): the page's compositing stage, a word or dials; the frame pass carries it only then.
  // Absent: every byte as it was.
  if (payload && sketch.manifest.grade != null && sketch.manifest.grade !== false) { const G = readGrade(sketch.manifest.grade); if (G) payload.grade = G; }

  // the WORLD CLOCK (worlds/controllable/world-clock.js): moments that slow or hold a live world on what happens in it, the
  // camera keeping real time; the page composes the clock only then. Absent: every byte as it was.
  if (payload && sketch.manifest.tempo != null && sketch.manifest.tempo !== false) { const T = readTempo(sketch.manifest.tempo); if (T) payload.tempo = T; }
  // (and a scene's own moments, its script's slow motion and freezes, playscape/ui/scenes.js sceneMoments: the clock
  // composed for them, beside the world's own; none ⇒ as it was)
  if (payload && playEv?.scenes) {
    const { sceneMoments } = await import('@/lib/graph/playscape/ui/scenes.js'), own = sceneMoments(playEv.scenes);
    if (own.length) payload.tempo = { moments: [...(payload.tempo?.moments ?? []), ...own.filter((m) => !(payload.tempo?.moments ?? []).some((x) => x.on === m.on))] };
  }

  // the SCREEN a game is made for (game/screen.js): the page holds its frame, the least a player sees, and the cameras'
  // fov is derived at it. Absent: the page's own box, every byte as it was.
  if (payload && sketch.manifest.screen != null) {
    const S = readScreen(sketch.manifest.screen);
    payload.screen = screenPayload(S);
    payload.viewBox = screenFrame(S, 1120);
  }

  // generic, opt-in AUDIO channel: synthesized WebAudio presence — an ambient
  // soundtrack (inline recipe or a stored beats artifact by `beatsRef`, inlined here so the page
  // stays self-contained), bus-event SFX cues, gait footsteps, and wind shaped by the scene's
  // declared time. Renders ONLY on the live /world path (the audio channel is not emitted on
  // capture runs, so muted bakes stay byte-identical); the /svg + /scene stills ignore it.
  // Presentation, not simulation — it reads sim state and never feeds back. Additive; absent ⇒
  // untouched. NOT flagged nonBakeable: audio has no visual frame, so stills stay full-fidelity.
  // A kind may name its own defaults first (`desc.audio(manifest) → audio spec`: the historic kind's
  // `soundtrack: 'default'` is its culture's period music); a kind without one reads the manifest's as written.
  if (payload && sketch.manifest.audio && typeof sketch.manifest.audio === 'object') {
    const mechanics = Array.isArray(sketch.manifest.game?.mechanics) ? sketch.manifest.game.mechanics.map((m) => m && m.kind).filter(Boolean) : [];
    const resolvedAudio = resolveWorldAudio(desc.audio ? desc.audio(sketch.manifest) : sketch.manifest.audio, { time, ref: sketch.ref, mechanics });
    if (resolvedAudio) payload.audio = resolvedAudio;
  }

  // generic, opt-in GAME channel: the level contract. A manifest may
  // carry `game` ({ levelRef, consumes, produces, presets, on? }) declaring the level's signature —
  // which store slices parameterize it and which typed events its outcome envelope may carry.
  // The emitted page gains the `__mojGame` bridge: params arrive from a hosting game SHELL via
  // versioned postMessage (or fall back to the contract's `presets.default`, so a level with no
  // shell stays playable standalone), and ONE outcome envelope leaves at level end. The store
  // itself lives in the shell/artifact, never here — play data never enters mojulo. Contract
  // faults are authoring errors: fail the mint loudly, not the player. Additive; absent ⇒
  // byte-identical HTML to today. NOT nonBakeable: the contract adds no visual frame, and capture
  // runs keep the bridge (preset-fed, messaging inert) so completability audits can read the
  // envelope from the probe stream.
  if (payload && sketch.manifest.game && typeof sketch.manifest.game === 'object') {
    const { validateLevelContract, normalizeLevelContract } = await import('@/lib/graph/game/level-contract.js');
    // chapters that carry add their setFlag rows (idempotent over a mechanics-synthesized contract)
    const { chapterContract } = await import('@/lib/graph/playscape/ui/chapters.js');
    const { sceneContract } = await import('@/lib/graph/playscape/ui/scenes.js');
    const game = sceneContract(chapterContract(sketch.manifest.game, sketch.manifest.play), sketch.manifest.play);
    const v = validateLevelContract(game);
    if (!v.ok) throw new Error(`game channel contract is invalid:\n- ${v.errors.join('\n- ')}`);
    payload.game = normalizeLevelContract(game);
  }
  // a side-view fight on the world (an arena, versus/versus-arena.js): the plane, the walls, the roster solved here,
  // the level wire's names; the page's versus channel fights on it. Absent ⇒ nothing (scene/channels/versus.js).
  if (payload && sketch.manifest.versus && typeof sketch.manifest.versus === 'object') {
    const { versusArenaData } = await import('@/lib/graph/versus/versus-page.js');
    const { withCharacters, characterBodies } = await import('@/lib/graph/versus/versus-character.js');
    const measured = await withCharacters(sketch.manifest.versus);
    // a character fights in its own body: its rig's parts, carried once per character (none: nothing added)
    payload.versus = versusArenaData({ ...measured, bodies: await characterBodies(measured.roster, { register: measured.register ?? null }) });
    // a fight game (one with a register) sounds its blows from the SFX shelf (versus/versus-sfx.js): its cues on the
    // page's audio channel, joining what audio the level already has (its own cues win); an arena made before the
    // register carries none and keeps its beeps
    const { fightAudio } = await import('@/lib/graph/versus/versus-sfx.js');
    const fa = fightAudio({ register: measured.register ?? null });
    if (fa) {
      const A = resolveWorldAudio(fa, { time, ref: sketch.ref });
      payload.audio = payload.audio ? { ...payload.audio, cues: { ...A.cues, ...(payload.audio.cues ?? {}) }, vary: payload.audio.vary ?? A.vary, mix: payload.audio.mix ?? A.mix } : A;
    }
  }
  // a brawl on the world (brawl/brawl-levels.js brawlLevel): its practice yard, the belt and the practice (who plays,
  // the dummies, the things); the page's brawl channel plays it, its blows sounded from the SFX shelf as a fight's are.
  // Absent (or a brawl block with no practice yet) ⇒ nothing (scene/channels/brawl.js).
  if (payload && sketch.manifest.brawl && typeof sketch.manifest.brawl === 'object' && sketch.manifest.brawl.practice) {
    const { brawlYardData } = await import('@/lib/graph/brawl/brawl-page.js');
    // its roster's characters measured from the store as a fight's are, each played in its own body with its own clips
    // (under a register, its lit export, for the yard to draw every body the register's one way), as a fight's arena does
    const { withCharacters, characterBodies } = await import('@/lib/graph/versus/versus-character.js');
    const practice = await withCharacters(sketch.manifest.brawl.practice);
    const bodies = Array.isArray(practice.roster) ? await characterBodies(practice.roster, { register: sketch.manifest.brawl.register ?? null }) : null;
    payload.brawl = brawlYardData({ ...sketch.manifest.brawl, practice }, bodies);
    const { fightAudio } = await import('@/lib/graph/versus/versus-sfx.js');
    const fa = fightAudio({ register: sketch.manifest.brawl.register ?? 'western' });
    if (fa) {
      const A = resolveWorldAudio(fa, { time, ref: sketch.ref });
      payload.audio = payload.audio ? { ...payload.audio, cues: { ...A.cues, ...(payload.audio.cues ?? {}) }, vary: payload.audio.vary ?? A.vary, mix: payload.audio.mix ?? A.mix } : A;
    }
  }
  // an athletic meet on a track (contest/meet-arena.js): the event, the lanes, the register, the contest compiled, the
  // level wire's names; the page's meet channel runs it. Absent ⇒ nothing (scene/channels/contest.js). Each sport's
  // athletes (characters by ref, contest/athletes.js) are packed here, so a sport follows its characters' edits
  if (payload && sketch.manifest.meet && typeof sketch.manifest.meet === 'object') {
    const { meetArenaData } = await import('@/lib/graph/contest/meet-arena.js');
    const { athleteBodies } = await import('@/lib/graph/contest/athletes.js');
    payload.meet = meetArenaData(sketch.manifest.meet, { bodies: await athleteBodies(sketch.manifest.meet.athletes) });
  }
  // a net game on a court (contest/match-arena.js): the sport, the players, the register, the contest compiled, the
  // level wire's names; the page's court channel plays it. Absent ⇒ nothing (scene/channels/contest.js).
  if (payload && sketch.manifest.court && typeof sketch.manifest.court === 'object') {
    const { matchArenaData } = await import('@/lib/graph/contest/match-arena.js');
    const { athleteBodies } = await import('@/lib/graph/contest/athletes.js');
    payload.court = matchArenaData(sketch.manifest.court, { bodies: await athleteBodies(sketch.manifest.court.athletes) });
  }
  // a turn sport on a course (contest/turn-arena.js): the sport, the seats, the register, the contest compiled, the
  // level wire's names; the page's turns channel plays it. Absent ⇒ nothing (scene/channels/contest.js).
  if (payload && sketch.manifest.turns && typeof sketch.manifest.turns === 'object') {
    const { turnsArenaData } = await import('@/lib/graph/contest/turn-arena.js');
    const { athleteBodies } = await import('@/lib/graph/contest/athletes.js');
    payload.turns = turnsArenaData(sketch.manifest.turns, { bodies: await athleteBodies(sketch.manifest.turns.athletes) });
  }
  // a team goal game on a pitch (contest/team-arena.js): the sport, the players, the register, the contest compiled,
  // the level wire's names; the page's pitch channel plays it. Absent ⇒ nothing (scene/channels/contest.js).
  if (payload && sketch.manifest.pitch && typeof sketch.manifest.pitch === 'object') {
    const { teamArenaData } = await import('@/lib/graph/contest/team-arena.js');
    const { athleteBodies } = await import('@/lib/graph/contest/athletes.js');
    payload.pitch = teamArenaData(sketch.manifest.pitch, { bodies: await athleteBodies(sketch.manifest.pitch.athletes) });
  }
  // a bat-and-ball game on a field (contest/innings-arena.js): the sport, the players, the register, the contest
  // compiled, the level wire's names; the page's innings channel plays it. Absent ⇒ nothing (scene/channels/contest.js).
  if (payload && sketch.manifest.innings && typeof sketch.manifest.innings === 'object') {
    const { inningsArenaData } = await import('@/lib/graph/contest/innings-arena.js');
    const { athleteBodies } = await import('@/lib/graph/contest/athletes.js');
    payload.innings = inningsArenaData(sketch.manifest.innings, { bodies: await athleteBodies(sketch.manifest.innings.athletes) });
  }
  // a persona's read on a SCREEN in the world (persona/screen.js: the news broadcast): each screen its read compiled, its
  // captions cued, the fidelity the world's era gives its hero; the page's broadcasts channel plays it. Absent ⇒ nothing.
  if (payload && sketch.manifest.broadcasts !== undefined) {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const { broadcastScreens } = await import('@/lib/graph/persona/screen.js');
    payload.broadcasts = broadcastScreens(sketch.manifest.broadcasts, { era, lookup: (r) => SketchRepository.getByRef(r) });
  }

  // a board game lifted into a hologram arena (tabletop/holo-arena.js): the game dealt, its board on the stage, each
  // kind's body, the level wire's names; the page's holo channel plays it. Absent ⇒ nothing (scene/channels/holo.js).
  if (payload && sketch.manifest.holo && typeof sketch.manifest.holo === 'object') {
    const { holoArenaData } = await import('@/lib/graph/tabletop/holo-arena.js');
    payload.holo = holoArenaData(sketch.manifest.holo);
  }
  // a board over the world's own ground (board/board-scene.js boardOverWorld: a level played as a tactics battle): its
  // spots a layer over the stage, its battle and the figures of who fights it. Absent ⇒ nothing (scene/channels/board.js).
  // (a city's `board` is its plan's street grid, city/plan: never spots)
  if (payload && kind !== 'board' && kind !== 'city' && sketch.manifest.board && typeof sketch.manifest.board === 'object') {
    const [{ boardOverWorld }, { boardFigures }] = await Promise.all([import('@/lib/graph/board/board-scene.js'), import('@/lib/graph/board/board-figures.js')]);
    Object.assign(payload, boardOverWorld(payload, sketch.manifest.board, { play: sketch.manifest.play }));
    Object.assign(payload, await boardFigures(payload, { heroFigure, figures: sketch.manifest.board.battle?.figures }));
  }

  // UNSHADED honesty: FLAT_LIGHT only reaches the kinds that shade
  // through the ctx.light seam onto the vexar Lambert solve (workbench / assembler / manji-tree,
  // and unitRef rig figures inside a controllable world). Two families are NOT flattened: the
  // environment kinds (rooms / suites / cities / floorplans / dungeons) render through
  // scene-css3d's baked, camera-independent traced-diffusion model that FLAT_LIGHT can't touch;
  // and the other object studies (figure / carved-solid / css3d-turntable, science views) bake
  // their own lighting internally rather than through ctx.light. For all of these, unshaded is a
  // silent no-op (deliberately not chased — a separate, larger change, out of scope here), so
  // surface a non-fatal note. Payload-only metadata — emitThreeWorld destructures known keys and
  // ignores this, so no emitted page changes; absent unshaded ⇒ unset.
  if (unshaded && payload && !UNSHADED_LAMBERT_KINDS.has(kind)) {
    payload.unshadedWarning = `kind '${kind}' does not shade through the vexar FLAT_LIGHT seam (it bakes environment/self lighting), so unshaded export did not flatten it — the exported base still carries baked lighting.`;
  }

  // the LOOK lands last among the face passes: every face the world placed above (items, statues, figures) is baked
  // under one light
  if (payload && lookSpec) applyLook(payload, lookSpec, { bake: bakeLook });

  // A recipe-level unit declaration (`manifest.metersPerUnit`): a kind authored at another
  // scale (the fractal city's storey is 0.82 units — a town scale, not metres) says so on the
  // recipe, and the exporters' root scale + the engine score follow (scene-gltf, engine-score),
  // so a level reads at human scale beside an engine character. A kind that declares its own
  // (the floorplan: feet) wins; absent both ⇒ unset, byte-identical. Web render: untouched.
  if (payload && payload.metersPerUnit == null) {
    const mpu = Number(manifest?.metersPerUnit);
    if (Number.isFinite(mpu) && mpu > 0) payload.metersPerUnit = mpu;
  }
  // A recipe that carries its own `units` label (the workbench family: `units:'cm'`) is the
  // same declaration in a different spelling — the print scale, USD and the Blender pack already
  // read it through world-units.js; the glTF root and every engine leg now do too, so a 9 cm mug
  // imports 9 cm tall, not 9 m. Only the recipe's OWN label
  // counts here (source 'manifest'): a kind's authoring unit (the floorplan's feet) is the kind's
  // to declare on its payload, and a label-less recipe stays byte-identical — one rule with the
  // print path, which refuses to assume centimetres. Metres (mpu 1) leaves the key unset.
  if (payload && payload.metersPerUnit == null) {
    const declared = declaredUnits(manifest);
    if (declared && declared.source === 'manifest') {
      const mpu = metersPerUnitFor(declared.units);
      if (Number.isFinite(mpu) && mpu > 0 && mpu !== 1) payload.metersPerUnit = mpu;
    }
  }

  // generic, opt-in MARKS: a pointer at a world point — authored `marks`, and the rigidity sensor's weak spots when
  // the row stores a `strength` spec (`strength.show: false` keeps them off). Only its rings pulse; the part, the
  // arrow and the label stay still. It is not a face, so no mesh export carries it. Absent both ⇒ payload untouched.
  if (payload && ((Array.isArray(manifest.marks) && manifest.marks.length) || (manifest.strength && typeof manifest.strength === 'object' && manifest.strength.show !== false))) {
    const { worldMarks } = await import('@/lib/graph/strength/world-marks');
    const marks = worldMarks(payload, manifest, { mmPerUnit: (payload.metersPerUnit ?? 1) * 1000 });
    if (marks.length) payload.marks = marks;
  }

  // generic, opt-in SHOOT PLAN (lib/graph/shoot/): cameras keyed in After Effects terms and a cut list, drawn by the
  // World page as objects (frustum, point of interest, motion path, a dot per frame). Not a face, so no mesh export
  // carries it; renderers read the plan itself. A key may follow something that moves on a schedule (a walker, a car,
  // a mover), read off this payload. Absent, or nothing readable ⇒ payload untouched.
  if (payload && manifest.shoot && typeof manifest.shoot === 'object') {
    const { normalizeShoot, lowerShoot } = await import('@/lib/graph/shoot/plan');
    const { shootSubjects, worldIsLive } = await import('@/lib/graph/shoot/subjects');
    const subjects = shootSubjects(payload);
    const { plan } = normalizeShoot(manifest.shoot, { subjects });
    // a live world (entities, physics) plays as it goes: the page runs the plan on its clock instead of rewinding it
    if (plan) payload.shoot = lowerShoot(plan, { subjects, live: worldIsLive(payload) });
  }

  // (a physical stage's tree records serve its blocks only: a world with no one in it, or no physics, never carries them)
  if (payload && payload.physicalTrees !== undefined) delete payload.physicalTrees;
  if (payload && payload.physicalGround !== undefined) delete payload.physicalGround;
  if (payload && payload.physicalRing !== undefined) delete payload.physicalRing;
  return { payload, kind };
}

// The kinds whose faces shade through the ctx.light → vexar Lambert solve (lowerObjectFaces /
// bakeUnitRig), which FLAT_LIGHT genuinely neutralizes to raw albedo. Every other kind bakes its
// lighting elsewhere (scene-css3d traced diffusion, or an internal per-kind solve) that FLAT_LIGHT
// can't reach — see the unshadedWarning above. `fractal-city` honours `ctx.unshaded` in its own
// assembler (plain lighting + FLAT_LIGHT, no diffusion/moonlight/shadows), so it flattens too.
const UNSHADED_LAMBERT_KINDS = new Set(['workbench', 'scad', 'assembler', 'layered', 'manji-tree', 'controllable', 'fractal-city', 'dungeon']);
