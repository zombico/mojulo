/**
 * THE GODOT MARKS — one portability source. What a Godot export runs, said once, and read by both the export check
 * (engine-portability.js, engine-score.js's ledger) and the cosmos registry (cosmos/facets, read-sources.js), so the
 * ruler and the export cannot disagree.
 *
 *   built         the kernel runs it as the web does (or, for a look, carries it whole)
 *   approximated  it runs, simpler or in part: the `how` says what stays the web's
 *   absent        nothing in the kernel runs it: the export names it, never drops it silently
 *
 * Every table here is CLOSED against the thing it marks: a new page input, controllable rule, events key, gait shape,
 * system kind or mind axis without a mark fails godot-marks.test.js. Flip a mark in the step that builds its kernel
 * part, never before (the ratchet then asks for the conformance scenario that names it).
 *
 * Pure data and small reads. No module with a builder in it is imported, so the cosmos facets can read it.
 */

export const GODOT_MARKS = Object.freeze(['built', 'approximated', 'absent']);
const RANK = { built: 0, approximated: 1, absent: 2 };
/** The worse of marks: absent over approximated over built; none → built. */
export const worstMark = (...marks) => marks.flat().reduce((w, m) => (RANK[m] > RANK[w] ? m : w), 'built');

const B = 'built', P = 'approximated', A = 'absent';
const m = (godot, how) => Object.freeze({ godot, ...(how ? { how } : {}) });

// ── the controllable runtime's rules (worlds/controllable/compose.js RULES) ──────────────────────────────────────────
// kernel/walker.gd walks the pilot (walk), a spring arm follows a suit (follow), and first person is the walker's own
// camera (eye). The platform rule jumps with fixed numbers: its dash, charged leap, climb and the moves a power unlocks
// (double jump, glide, high jump: gameworld/actions.js TRAVERSAL_MOVES) are the web's.
export const RULE_MARKS = Object.freeze({
  walk: m(B, 'kernel/walker.gd'),
  follow: m(B, 'kernel/walker.gd on a SpringArm3D behind the suit'),
  eye: m(B, 'kernel/walker.gd first person, mouse look'),
  platform: m(P, 'the walker jumps with fixed numbers (walker.gd jump, speed); the rule\'s own jump, run, air control, dash, charged leap, climb and unlocked moves are the web\'s'),
  glide: m(A, 'no glide in kernel/walker.gd'),
  overhead: m(A, 'no overhead camera: the walker stays first person or on its spring arm'),
  side: m(A, 'no side camera, no lane pilot held to a spine'),
  fixed: m(A, 'no fixed stations, no cut'),
  shot: m(A, 'no directed shot: scenes do not travel'),
  clock: m(P, 'a figure-frames body\'s self-playing loop (a glyph, a turntable): the body stands, its frames do not play'),
  mover: m(A, 'movers do not travel (skipped_movers): a moving platform or lift stands at rest'),
  launcher: m(A, 'no launcher: a catapult stands still'),
  drive: m(A, 'no drive rule: a vehicle pilot does not travel'),
  racer: m(A, 'no racer rule: rival drivers stand still'),
  fly: m(A, 'no fly rule'),
  patrol: m(A, 'no patrol: a guard stands where it was placed'),
  ai: m(A, 'no mind: an AI character stands where it was placed (the cast\'s bus ops still move it)'),
});

// space.camera's values, by the camera rule each lowers to (gameworld/cameras.js)
export const CAMERA_RULE = Object.freeze({ 'third-person': 'follow', 'first-person': 'eye', 'top-down': 'overhead', side: 'side', fixed: 'fixed' });

// ── the World page's inputs (scene-three.js emitThreeWorld: a resolved payload spreads into it) ─────────────────────
// `option` rows are how the page is drawn, not what the world is: they carry nothing to an engine.
const OPTION = Object.freeze({ godot: B, option: true });
export const PAGE_MARKS = Object.freeze({
  faces: m(B, 'model.glb (scene-gltf.js), unlit with COLOR_0'),
  cameras: m(B, 'the GLB\'s cameras'),
  viewBox: OPTION, title: OPTION, inline: OPTION, cdn: OPTION, capture: OPTION, pack: OPTION, hud: OPTION, wireframe: OPTION, spin: OPTION, decollide: OPTION, metersPerUnit: OPTION,
  bg: m(A, 'the page background: no WorldEnvironment reads it (sky_approximated)'),
  backdrop: m(A, 'the backdrop is not carried (sky_approximated)'),
  sky: m(A, 'score.sky.preset is emitted but level.gd never reads it; the dome is not carried'),
  light: m(B, 'baked into the vertex colours by scene-gltf.js, as the page bakes it'),
  glow: m(A, 'glow sprites (camera-facing additive cards) are not drawn'),
  textures: m(B, 'embedded in the GLB (TEXCOORD_0 + PNG)'),
  cutouts: m(P, 'the cutout textures ride the GLB opaque: no alpha test'),
  soft: m(B, 'soft groups carry no colliders, as on the page'),
  repeats: m(B, 'baked into the GLB, one mesh per template'),
  ao: m(B, 'baked into the vertex colours'),
  walk: m(P, 'kernel/walker.gd walks it, standing on a flat plane at score.ground and the box colliders: the page casts its ground onto the land\'s faces (a hill is walked through, a hollow floated over)'),
  picks: m(A, 'pick popups are the page\'s'),
  tracers: m(A, 'tracers are not drawn'), planets: m(A, 'planets do not orbit'), movers: m(A, 'movers do not travel'), comets: m(A, 'comets are not drawn'),
  fields: m(A, 'field lines are not drawn'), surfaces: m(A, 'animated surfaces are not stepped'), heatSpheres: m(A, 'heat spheres are not drawn'),
  starSurfaces: m(A, 'star surfaces are not drawn'), buildups: m(A, 'buildups are not stepped'), transports: m(A, 'transports are not stepped'),
  deforms: m(A, 'deforms are not stepped'), raymarch: m(A, 'the raymarch layer is the page\'s'), signs: m(A, 'animated signage is not stepped'),
  physics: m(A, 'live physics bodies do not travel (skipped_physics)'), actions: m(A, 'input impulses on physics bodies do not travel'),
  entities: m(B, 'GLB nodes placed as the payload places them; their rules are marked by RULE_MARKS'),
  camera: m(B, 'the camera entity; its rule is marked by RULE_MARKS'),
  pilot: m(B, 'the walker pilots the player entity'),
  spectate: m(A, 'no spectator camera'), ai: m(A, 'no mind (P5)'), aiDifficulty: m(A, 'no mind to tune'), commander: m(A, 'no commander'),
  lock: m(A, 'no lock-on'), match: m(A, 'arena match modes do not travel'), hangar: m(A, 'the hangar is the page\'s'),
  colliders: m(B, 'StaticBody3D boxes (level.gd _build_colliders)'),
  breakables: m(P, 'held whole as solid colliders (breakables_held): breaking them is the web\'s'),
  breakPieces: m(A, 'break pieces are not carried'), wreckExplodes: m(A, 'wreck finishers are not carried'),
  shadows: m(A, 'the controllable shadow keys are not drawn'), smoke: m(A, 'smoke is not drawn'),
  tutorial: m(A, 'the tutorial step director does not travel'),
  figures: m(P, 'rigid per-bone parts (scene-gltf addRigFigure): no painted or blend-shape face, no ink on a game pack'),
  events: m(B, 'bus.json and score.json carry what the kernel runs; the keys they drop are named by EVENT_MARKS'),
  fog: m(A, 'the page\'s fog rides only on weather (weather-score.js)'),
  haze: m(A, 'haze is not carried'),
  splats: m(A, 'fur and grass splats are not drawn'),
  audio: m(P, 'the soundtrack and one-shot sounds play (kernel/sound.gd); positional sound and weather beds are the web\'s'),
  fx: m(A, 'camera-facing fx are not drawn (skipped_fx)'), effects: m(A, 'screen effects are not drawn'),
  spriteSfx: m(A, 'sprite sfx are not drawn (skipped_sprite_sfx)'), marks: m(A, 'strength marks are not drawn'),
  driveSurface: m(A, 'no drive rule to read it'),
  shoot: m(A, 'a shoot plan\'s cameras ride the GLB, but nothing plays the edit'),
  game: m(B, 'contract.json: the level ends through its contract (kernel/game.gd)'),
  walkers: m(A, 'city walkers are not stepped'), cars: m(A, 'traffic is not stepped'), carMeshes: m(A, 'traffic is not stepped'),
  signals: m(A, 'traffic signals are not stepped'), trafficLanes: m(A, 'traffic is not stepped'), trafficConstants: m(A, 'traffic is not stepped'),
  xr: m(A, 'WebXR is the page\'s'), toon: m(A, 'toon ink hulls are not drawn'), stream: m(A, 'streamed tiles do not travel'),
  strokeOverlay: m(A, 'the stroke overlay is not drawn'),
  terrain: m(P, 'the terrain\'s faces ride the GLB; its LOD and live grass are the web\'s'),
  crystalLight: m(P, 'performed live by kernel/crystal_light.gd; movers do not travel, so stones stand at rest'),
  fire: m(A, 'fire is not drawn'),
  doors: m(P, 'doors and doorways are triggers (kernel/level.gd _build_address); a door leaf does not swing'),
  items: m(P, 'items are triggers (kernel/level.gd _build_address); they are not drawn as the page draws them'),
  shallows: m(A, 'shallows are not drawn'), wetSand: m(A, 'wet sand is not drawn'), softGround: m(A, 'soft ground is not drawn'),
  jets: m(A, 'jets are not drawn'), jetLight: m(A, 'jet light is not drawn'), sway: m(A, 'vegetation does not sway'),
  flicker: m(A, 'lights do not flicker'), motes: m(A, 'motes are not drawn'),
  weather: m(P, 'fog, colour and light (kernel/weather.gd); falls, landings and lightning are the web\'s'),
  tone: m(A, 'the tone grade has no pass: a toned world arrives grey'),
  liveGrass: m(A, 'live grass is not drawn'),
  pixel: m(A, 'the pixel medium has no SubViewport pass'),
});

// ── the events manifest's keys (the page reads the whole object; what travels rides bus.json or score.json) ──────────
// `carried` rows ride the export (bus.json's fragment, cast, stats, inputs; score.json's hud, hudStyle, menus, looks).
export const EVENT_MARKS = Object.freeze({
  reactions: m(B, 'bus.json'), watches: m(B, 'bus.json'), sequences: m(B, 'bus.json'), timers: m(B, 'bus.json'), vars: m(B, 'bus.json'),
  sources: m(B, 'bus.json: zones and uses'), initial: m(B, 'bus.json'), entities: m(B, 'bus.json: the bus\'s own entities (not drawn: see effect:entities)'),
  budget: m(B, 'bus.json'), depthCap: m(B, 'bus.json'),
  cast: m(B, 'bus.json cast rows (kernel/cast.gd)'), stats: m(B, 'bus.json (kernel/stats.gd)'),
  inputs: m(P, 'keys and clicks travel (bus.json inputs); a pick or a shot on a marker does not'),
  hud: m(B, 'score.json hud (kernel/hud.gd)'), style: m(B, 'score.json hudStyle'), register: m(P, 'score.json hudStyle.register: its motion, sound, cursor and light are the web\'s'),
  menus: m(B, 'score.json menus (level.gd)'),
  looks: m(P, 'score.json looks (kernel/looks.gd): nothing wears one until a script calls looks.wear'),
  scenes: m(A, 'scenes do not travel: no runner, no shots, no text box, no choices'),
  quests: m(A, 'quests do not travel: no journal, no toasts'),
});
/** The events keys an export carries (bus.json or score.json), whatever their mark. */
export const EVENT_CARRIED = Object.freeze(Object.keys(EVENT_MARKS).filter((k) => !['scenes', 'quests'].includes(k)));

// ── a figure's gaits (polygonizer/hero-motion.js MOTION_GAITS), by the shape of the gait's row ───────────────────────
// The suit plays its idle and its walk (the locomotion row's `walk`) and its swings; a jump is the walker's own (no
// clip), a stop is a stop (no clip). Nothing plays a pose, a stance, a seat or a vault: the cast's arrive says a pose
// on the bus and draws none.
const AIR_MOVES = Object.freeze({ jump: P, jumpForward: P, jumpBack: P, runningJump: P });
export function gaitMark(name, row) {
  if (!row || typeof row !== 'object') return m(A, 'not a gait');
  if (row.base !== undefined) return name === 'walk' ? m(B, 'the suit\'s walk clip, played at the walker\'s pace') : m(A, 'the walker has one pace: only the walk plays');
  if (row.from !== undefined) return m(P, 'the walker stops; the stop clip does not play');
  if (row.vault !== undefined) return m(A, 'no vault');
  if (row.family !== undefined || row.seconds === undefined) return m(A, 'nothing plays a pose, a stance or a seat');
  return AIR_MOVES[name] ? m(P, 'the walker jumps; the clip does not play') : m(A, 'no air jump and no roll in kernel/walker.gd');
}

// ── power.systems (gameworld/actions.js SYSTEM_KINDS): what a system lowers to ───────────────────────────────────────
export const SYSTEM_MARKS = Object.freeze({
  resource: m(B, 'a stat resource, its keys and its HUD (kernel/stats.gd, hud.gd)'),
  stamina: m(B, 'one stat pool spent by every action (kernel/stats.gd)'),
  unlock: m(A, 'a power\'s traversal move changes the platform rule, which the walker does not read (RULE_MARKS.platform)'),
  transform: m(P, 'a form is a stat tier and a transfigure (kernel/cast.gd, drawn simpler)'),
  equip: m(B, 'powers from carried gear: stats and cues'),
  place: m(A, 'a pad wakes what stands asleep there through the cast, but the towers it wakes fire through a mind'),
});

// ── space.traversal (playscape/objects ENTRIES): the runtime rule each lowers to, if any ─────────────────────────────
export const TRAVERSAL_RULE = Object.freeze({ door: null, platform: 'mover', lift: 'mover', catapult: 'launcher', bridge: null, ladder: 'platform', stairs: null });
const TRAVERSAL_HOW = Object.freeze({
  door: m(P, 'a door is a trigger; its leaf does not swing'),
  bridge: m(B, 'a static deck: a floor face and its collider'),
  platform: m(P, 'a static deck travels (a floor face and its collider); a moving one is a mover and stands at rest'),
  stairs: m(B, 'treads as faces over solid blocks'),
});
export function traversalMark(entry) {
  if (TRAVERSAL_HOW[entry]) return TRAVERSAL_HOW[entry];
  const rule = TRAVERSAL_RULE[entry];
  if (rule === undefined) return m(A, 'not marked');
  // a ladder's climb is the platform rule's: the walker does not climb at all
  if (entry === 'ladder') return m(A, 'the walker does not climb (the platform rule\'s climb is the web\'s)');
  return m(RULE_MARKS[rule].godot, `lowers to the ${rule} rule: ${RULE_MARKS[rule].how}`);
}

// ── space.links (era/floormap.js LINK_KINDS): how rooms join ────────────────────────────────────────────────────────
export const LINK_MARKS = Object.freeze({
  open: m(B, 'an opening in the geometry'),
  door: m(P, 'a doorway is a trigger; its leaf does not swing'),
  stair: m(B, 'treads as faces over solid blocks'),
  gap: m(P, 'jumped with the walker\'s fixed jump (RULE_MARKS.platform)'),
});

// ── the mind (cosmos facet mind): the kernel has no mind. A value that asks nothing of one travels ─────────────────
// ambient and passive are the practice dummy: it stands to be met and hit (kernel/cast.gd, combat.gd)
export const MIND_TRAVELS = Object.freeze({
  motivation: ['ambient'], aggressiveness: ['passive'], rank: [], skill: [], perception: [], pathing: [],
  // a routine is cues on the clock's hour and the cast's walk, which the kernel runs (II5): no mind needed
  squad: ['none'], social: ['none', 'schedule'], commander: ['none'],
});
export const mindMark = (axis, value) => ((MIND_TRAVELS[axis] || []).includes(value)
  ? m(B, 'asks nothing of a mind: the character stands to be met')
  : m(A, 'the kernel has no mind (worlds/controllable/mind.js is not ported)'));
